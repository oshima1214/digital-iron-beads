import { createStore, useStore } from 'zustand';

import { convertImage } from '@/core/convert/convert';
import { type ConvertSettings, defaultConvertSettings, type RgbaImage, WORK_CELL_PX } from '@/core/convert/types';
import { createProject, type Project } from '@/core/file/project';
import { adjustImage, type CropRect, cropImage } from '@/core/image/adjust';
import { createSheet, type Sheet } from '@/core/sheet/sheet';
import { createAutosaver } from '@/core/util/autosave';
import type { ProjectRepo } from '@/platform/projectRepo.types';

export interface ImageIO {
  encode(img: RgbaImage): Promise<Uint8Array>;
  load(uri: string): Promise<RgbaImage>;
}

export interface DraftState {
  project: Project | null;
  /** 取り込んだ元画像（長い辺 2048px 以下） */
  image: RgbaImage | null;
  preview: Sheet | null;
  busy: boolean;
  /** open に失敗したとき 'open-failed' */
  error: 'open-failed' | null;
  startFromImage(img: RgbaImage, name: string): Promise<string>;
  open(id: string): Promise<void>;
  setCrop(rect: CropRect | undefined): void;
  setAdjust(brightness: number, contrast: number): void;
  setSettings(partial: Partial<ConvertSettings>): void;
  /** 切り抜き・明るさ調整を反映した画像 */
  processed(): RgbaImage | null;
  convertPreview(quality: 'fast' | 'full'): void;
  finish(): Promise<string>;
  flush(): Promise<void>;
  /** 予約中の保存を済ませてから下書きを空にする（ホームに戻ったとき）。 */
  close(): Promise<void>;
}

export const FAST_CELL_PX = 2;

export function createDraftStore(repo: ProjectRepo, io: ImageIO, now: () => Date = () => new Date(), autosaveMs = 500) {
  const saver = createAutosaver<Project>((p) => repo.save(p), autosaveMs);
  let processedCache: { key: string; img: RgbaImage } | null = null;

  return createStore<DraftState>()((set, get) => {
    const update = (fn: (p: Project) => Project) => {
      const p = get().project;
      if (!p) return;
      const next = { ...fn(p), updatedAt: now().toISOString() };
      set({ project: next });
      saver.schedule(next);
    };

    return {
      project: null,
      image: null,
      preview: null,
      busy: false,
      error: null,

      async startFromImage(img, name) {
        const p = createProject(name, createSheet(29, 29), now());
        p.stage = 'setup';
        const image = await repo.saveSource(p.id, await io.encode(img));
        p.source = { image, brightness: 0, contrast: 0, convert: defaultConvertSettings(29) };
        await repo.save(p);
        processedCache = null;
        set({ project: p, image: img, preview: null, error: null });
        return p.id;
      },

      async open(id) {
        await saver.flush();
        processedCache = null;
        try {
          const p = await repo.load(id);
          if (!p.source) throw new Error('project has no source image');
          const img = await io.load(repo.sourceUri(id, p.source.image));
          set({ project: p, image: img, preview: null, error: null });
        } catch (e) {
          console.warn('could not open draft', e);
          set({ project: null, image: null, preview: null, error: 'open-failed' });
        }
      },

      setCrop(rect) {
        update((p) => (p.source ? { ...p, source: { ...p.source, crop: rect } } : p));
        set({ preview: null });
      },
      setAdjust(brightness, contrast) {
        update((p) => (p.source ? { ...p, source: { ...p.source, brightness, contrast } } : p));
        set({ preview: null });
      },
      setSettings(partial) {
        update((p) => {
          if (!p.source) return p;
          const convert = { ...p.source.convert, ...partial };
          return { ...p, source: { ...p.source, convert } };
        });
      },

      processed() {
        const { image, project } = get();
        const src = project?.source;
        if (!image || !src) return null;
        const key = JSON.stringify([src.crop, src.brightness, src.contrast]);
        if (processedCache?.key === key) return processedCache.img;
        let img = src.crop ? cropImage(image, src.crop) : image;
        if (src.brightness !== 0 || src.contrast !== 0) img = adjustImage(img, src.brightness, src.contrast);
        processedCache = { key, img };
        return img;
      },

      convertPreview(quality) {
        const img = get().processed();
        const settings = get().project?.source?.convert;
        if (!img || !settings) return;
        set({ preview: convertImage(img, settings, quality === 'fast' ? FAST_CELL_PX : WORK_CELL_PX) });
      },

      async finish() {
        const p = get().project;
        const img = get().processed();
        if (!p || !img || !p.source) throw new Error('nothing to finish');
        set({ busy: true });
        try {
          const sheet = convertImage(img, p.source.convert, WORK_CELL_PX);
          const done: Project = { ...p, sheet, stage: 'edit', updatedAt: now().toISOString() };
          set({ project: done, preview: sheet });
          saver.schedule(done);
          await saver.flush();
          if (saver.pending) throw new Error('could not save the project', { cause: saver.lastError });
          return done.id;
        } finally {
          set({ busy: false });
        }
      },

      flush: () => saver.flush(),

      async close() {
        await saver.flush();
        processedCache = null;
        set({ project: null, image: null, preview: null, error: null });
      },
    };
  });
}

let shared: ReturnType<typeof createDraftStore> | null = null;

export function draftStore() {
  if (!shared) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { projectRepo } = require('@/platform/projectRepo') as typeof import('@/platform/projectRepo');
    const { encodePng, loadRgba } = require('@/platform/pixels') as typeof import('@/platform/pixels');
    /* eslint-enable @typescript-eslint/no-require-imports */
    shared = createDraftStore(projectRepo, { encode: encodePng, load: (uri) => loadRgba(uri) });
  }
  return shared;
}

export function useDraft<T>(selector: (s: DraftState) => T): T {
  return useStore(draftStore(), selector);
}
