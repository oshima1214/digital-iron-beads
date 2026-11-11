import type { RgbaImage } from '@/core/convert/types';
import { drawRect, solid } from '@/core/convert/testing';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { createDraftStore } from './draft';

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
  store.getState().setSettings({ size: 13, maxColors: 5 });
  expect((await repo.load(id)).source?.convert.size).toBe(29);
  await jest.advanceTimersByTimeAsync(500);
  const saved = (await repo.load(id)).source?.convert;
  expect([saved?.size, saved?.maxColors]).toEqual([13, 5]);
});

test('convertPreview fast/full produce a sheet of the chosen size', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13 });
  store.getState().convertPreview('fast');
  expect(store.getState().preview?.width).toBe(13);
  store.getState().convertPreview('full');
  expect(store.getState().preview?.cells.some((v) => v !== 0)).toBe(true);
});

test('crop and adjust are applied before conversion', async () => {
  const { store, img } = setup();
  await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 13, removeBackground: false });
  store.getState().setCrop({ x: 20, y: 20, w: 40, h: 40 }); // 赤だけ
  store.getState().convertPreview('full');
  expect(new Set(store.getState().preview?.cells)).toEqual(new Set([3])); // 3 = 5005 あか
  store.getState().setAdjust(100, 0); // 真っ白
  store.getState().convertPreview('full');
  expect(new Set(store.getState().preview?.cells)).toEqual(new Set([1])); // 1 = 5001 しろ
});

test('finish converts, saves stage edit and the sheet', async () => {
  const { repo, store, img } = setup();
  const id = await store.getState().startFromImage(img, '作品 1');
  store.getState().setSettings({ size: 21 });
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
