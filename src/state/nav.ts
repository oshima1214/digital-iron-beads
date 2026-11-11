import { createStore, useStore } from 'zustand';

import type { Project } from '@/core/file/project';
import { type BeadCount, countBeads } from '@/core/sheet/counts';
import { type Plate, platesOf } from '@/core/sheet/plates';
import { createAutosaver } from '@/core/util/autosave';
import type { ProjectRepo } from '@/platform/projectRepo.types';

export interface NavState {
  project: Project | null;
  error: 'open-failed' | null;
  plates: Plate[];
  plateIndex: number;
  /** 今のプレートの色（多い順） */
  order: BeadCount[];
  colorIndex: number;
  /** 今のプレートの最後の色まで終わった */
  done: boolean;
  mirror: boolean;
  /** iPad mini の半分表示：0 = 上半分、1 = 下半分 */
  half: 0 | 1;
  open(id: string): Promise<void>;
  next(): void;
  prev(): void;
  jump(i: number): void;
  setPlate(i: number): void;
  toggleMirror(): void;
  setHalf(h: 0 | 1): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

export function createNavStore(repo: ProjectRepo, now: () => Date = () => new Date(), autosaveMs = 500) {
  const saver = createAutosaver<Project>((p) => repo.save(p), autosaveMs);

  return createStore<NavState>()((set, get) => {
    /** 位置を変えて、進み具合を自動保存に予約する。 */
    const go = (plateIndex: number, colorIndex: number, done = false) => {
      const p = get().project;
      if (!p) return;
      const plates = get().plates;
      const order = countBeads(p.sheet, plates[plateIndex]);
      const ci = clamp(colorIndex, Math.max(0, order.length - 1));
      const next = { ...p, nav: { plateIndex, colorIndex: ci }, updatedAt: now().toISOString() };
      set({ project: next, plateIndex, order, colorIndex: ci, done });
      saver.schedule(next);
    };

    return {
      project: null,
      error: null,
      plates: [],
      plateIndex: 0,
      order: [],
      colorIndex: 0,
      done: false,
      mirror: false,
      half: 0,

      async open(id) {
        await saver.flush();
        try {
          const p = await repo.load(id);
          const plates = platesOf(p.sheet);
          const pi = clamp(p.nav?.plateIndex ?? 0, plates.length - 1);
          const order = countBeads(p.sheet, plates[pi]);
          const ci = clamp(p.nav?.colorIndex ?? 0, Math.max(0, order.length - 1));
          set({ project: p, error: null, plates, plateIndex: pi, order, colorIndex: ci, done: false, half: 0 });
        } catch (e) {
          console.warn('could not open project for nav', e);
          set({ project: null, error: 'open-failed' });
        }
      },
      next() {
        const { order, colorIndex, plateIndex, done } = get();
        if (order.length === 0 || done) return;
        if (colorIndex >= order.length - 1) set({ done: true });
        else go(plateIndex, colorIndex + 1);
      },
      prev() {
        const { order, colorIndex, plateIndex, done } = get();
        if (order.length === 0) return;
        if (done) set({ done: false });
        else if (colorIndex > 0) go(plateIndex, colorIndex - 1);
      },
      jump(i) {
        go(get().plateIndex, i);
      },
      setPlate(i) {
        go(clamp(i, get().plates.length - 1), 0);
      },
      toggleMirror() {
        set({ mirror: !get().mirror });
      },
      setHalf(h) {
        set({ half: h });
      },
      flush: () => saver.flush(),
      async close() {
        await saver.flush();
        set({ project: null, error: null, plates: [], order: [], done: false });
      },
    };
  });
}

let shared: ReturnType<typeof createNavStore> | null = null;

export function navStore() {
  if (!shared) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { projectRepo } = require('@/platform/projectRepo') as typeof import('@/platform/projectRepo');
    shared = createNavStore(projectRepo);
  }
  return shared;
}

export function useNav<T>(selector: (s: NavState) => T): T {
  return useStore(navStore(), selector);
}
