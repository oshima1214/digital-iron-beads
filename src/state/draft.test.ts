import type { RgbaImage } from '@/core/convert/types';
import { createProject } from '@/core/file/project';
import { createSheet } from '@/core/sheet/sheet';
import { drawRect, solid } from '@/core/convert/testing';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { createDraftStore, NeedsBeadsError } from './draft';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup() {
  const repo = createMemoryRepo();
  const images = new Map<string, RgbaImage>();
  let last: RgbaImage | null = null;
  const io = {
    encode: async (img: RgbaImage) => {
      last = img;
      return new Uint8Array([1, 2, 3]);
    },
    load: async (uri: string) => images.get(uri) ?? last!,
  };
  const store = createDraftStore(repo, io, () => new Date('2026-11-11T00:00:00Z'));
  const img = solid(80, 80, [255, 255, 255, 255]);
  drawRect(img, 20, 20, 40, 40, [221, 8, 8, 255]);
  return { repo, store, img };
}

const beadsOf = (store: ReturnType<typeof setup>['store']) => {
  const p = store.getState().preview;
  return p?.kind === 'beads' ? p.sheet : null;
};

test('startFromImage saves a setup-stage project with source and default settings', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  const p = await repo.load(id);
  expect(p.stage).toBe('setup');
  expect(p.name).toBe('作品 1');
  expect(p.source?.image).toBe('source.png');
  expect(p.source?.convert.size).toBe(29);
});

test('setSettings autosaves after 500ms', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13, noise: 2 });
  expect((await repo.load(id)).source?.convert.size).toBe(29);
  await jest.advanceTimersByTimeAsync(500);
  const saved = (await repo.load(id)).source?.convert;
  expect([saved?.size, saved?.noise]).toEqual([13, 2]);
});

test('convertPreview fast/full produce a sheet of the chosen size', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13 });
  store.getState().setBeadSet('32', []);
  store.getState().convertPreview('fast');
  expect(beadsOf(store)?.width).toBe(13);
  store.getState().convertPreview('full');
  expect(beadsOf(store)?.cells.some((v) => v !== 0)).toBe(true);
});

test('crop and adjust are applied before conversion', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13, removeBackground: false });
  store.getState().setBeadSet('32', []);
  store.getState().setCrop({ x: 20, y: 20, w: 40, h: 40 }); // 赤だけ
  store.getState().convertPreview('full');
  expect(new Set(beadsOf(store)?.cells)).toEqual(new Set([3])); // 3 = 5005 あか
  store.getState().setAdjust(100, 0); // 真っ白
  store.getState().convertPreview('full');
  expect(new Set(beadsOf(store)?.cells)).toEqual(new Set([1])); // 1 = 5001 しろ
});

test('finish converts, saves stage edit and the sheet', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 21 });
  store.getState().setBeadSet('16', []);
  await store.getState().finish();
  const p = await repo.load(id);
  expect(p.stage).toBe('edit');
  expect(p.sheet.width).toBe(21);
  expect(p.sheet.cells.some((v) => v !== 0)).toBe(true);
});

test('open restores the draft from the repo (resume)', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 58 });
  await store.getState().flush();
  const store2 = createDraftStore(repo, { encode: async () => new Uint8Array(), load: async () => img }, () => new Date());
  await store2.getState().open(id);
  expect(store2.getState().project?.source?.convert.size).toBe(58);
  expect(store2.getState().image?.width).toBe(80);
});

test('changing crop or adjust invalidates the preview', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().convertPreview('fast');
  expect(store.getState().preview).not.toBeNull();
  store.getState().setCrop({ x: 0, y: 0, w: 40, h: 40 });
  expect(store.getState().preview).toBeNull();
  store.getState().convertPreview('fast');
  store.getState().setAdjust(10, 0);
  expect(store.getState().preview).toBeNull();
});

test('close() flushes pending changes and clears the draft (Home re-entry)', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 116 });
  await store.getState().close();
  expect((await repo.load(id)).source?.convert.size).toBe(116);
  expect(store.getState().project).toBeNull();
  expect(store.getState().image).toBeNull();
});

test('open() of a missing project sets an error instead of hanging', async () => {
  const { store } = setup();
  await store.getState().open('does-not-exist');
  expect(store.getState().error).toBe('open-failed');
  expect(store.getState().project).toBeNull();
});

test('open() of a project without source sets an error', async () => {
  const { repo, store } = setup();
  const p = createProject('x', createSheet(13, 13), new Date());
  p.stage = 'setup';
  await repo.save(p);
  await store.getState().open(p.id);
  expect(store.getState().error).toBe('open-failed');
});

test('finish() rejects when the save fails', async () => {
  const { repo, store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  repo.failSaves(true);
  await expect(store.getState().finish()).rejects.toThrow();
});

test('setName trims and autosaves; it can be emptied (a name is required later, not here)', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setName('  ねこ  ');
  expect(store.getState().project?.name).toBe('ねこ');
  await jest.advanceTimersByTimeAsync(600);
  expect((await repo.load(id)).name).toBe('ねこ');
  store.getState().setName('   ');
  expect(store.getState().project?.name).toBe('');
});

test('bead sets: original shows the image colors, owned with nothing chosen cannot convert', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  expect(store.getState().project?.source?.convert.beadSet).toBe('original');
  store.getState().setSettings({ size: 13 });
  store.getState().convertPreview('fast');
  const p = store.getState().preview;
  expect(p?.kind).toBe('original');
  if (p?.kind === 'original') expect([p.image.width, p.image.height]).toEqual([13, 13]);
  store.getState().setBeadSet('owned', []);
  store.getState().convertPreview('fast');
  expect(store.getState().preview?.kind).toBe('no-beads');
  store.getState().setBeadSet('owned', [40, 1]);
  expect(store.getState().project?.source?.convert.allowedBeads).toEqual([1, 40]);
  store.getState().convertPreview('fast');
  expect(store.getState().preview?.kind).toBe('beads');
});

test('finish refuses to make a project from the original colors (asks for beads first)', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  await expect(store.getState().finish()).rejects.toThrow(NeedsBeadsError);
  store.getState().setBeadSet('owned', []);
  await expect(store.getState().finish()).rejects.toThrow(NeedsBeadsError);
  expect((await repo.load(id)).stage).toBe('setup');
});

test('two-color ignores the bead set (it has its own two beads)', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13, preset: 'twoColor', twoColor: { dark: 8, light: 1, threshold: 0.5 } });
  store.getState().convertPreview('fast');
  expect(store.getState().preview?.kind).toBe('beads');
  await expect(store.getState().finish()).resolves.toBeTruthy();
});
