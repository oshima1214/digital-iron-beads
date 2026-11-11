import { createProject } from '@/core/file/project';
import { createSheet, idx } from '@/core/sheet/sheet';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { createNavStore } from './nav';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** 58×58：プレート0 に 3色（3×5, 8×3, 2×1）、プレート1 は空、プレート2 に 1色。 */
async function setup(nav?: { plateIndex: number; colorIndex: number }) {
  const repo = createMemoryRepo();
  const sheet = createSheet(58, 58);
  for (let x = 0; x < 5; x++) sheet.cells[idx(sheet, x, 0)] = 3;
  for (let x = 0; x < 3; x++) sheet.cells[idx(sheet, x, 1)] = 8;
  sheet.cells[idx(sheet, 0, 2)] = 2;
  sheet.cells[idx(sheet, 0, 30)] = 5; // プレート2（左下）
  const p = createProject('作品', sheet, new Date('2026-11-10T00:00:00Z'));
  if (nav) p.nav = nav;
  await repo.save(p);
  const store = createNavStore(repo, () => new Date('2026-11-11T00:00:00Z'));
  await store.getState().open(p.id);
  return { repo, store, id: p.id };
}

test('order is by count desc and next/prev/jump/done work', async () => {
  const { store } = await setup();
  const st = () => store.getState();
  expect(st().plates).toHaveLength(4);
  expect(st().order.map((o) => o.index)).toEqual([3, 8, 2]);
  st().next();
  expect(st().colorIndex).toBe(1);
  st().jump(2);
  expect(st().colorIndex).toBe(2);
  st().next();
  expect(st().done).toBe(true);
  st().prev();
  expect([st().done, st().colorIndex]).toEqual([false, 2]);
  st().prev();
  st().prev();
  st().prev();
  expect(st().colorIndex).toBe(0);
});

test('setPlate resets color and done', async () => {
  const { store } = await setup();
  store.getState().next();
  store.getState().setPlate(2);
  expect([store.getState().plateIndex, store.getState().colorIndex, store.getState().done]).toEqual([2, 0, false]);
  expect(store.getState().order.map((o) => o.index)).toEqual([5]);
});

test('empty plate has no colours and does not crash on next/prev', async () => {
  const { store } = await setup();
  store.getState().setPlate(1);
  expect(store.getState().order).toEqual([]);
  store.getState().next();
  store.getState().prev();
  expect(store.getState().done).toBe(false);
});

test('saves nav position (autosave)', async () => {
  const { repo, store, id } = await setup();
  store.getState().setPlate(2);
  await jest.advanceTimersByTimeAsync(500);
  expect((await repo.load(id)).nav).toEqual({ plateIndex: 2, colorIndex: 0 });
});

test('open restores saved position', async () => {
  const { store } = await setup({ plateIndex: 0, colorIndex: 1 });
  expect([store.getState().plateIndex, store.getState().colorIndex]).toEqual([0, 1]);
});

test('clamps saved position', async () => {
  const { store } = await setup({ plateIndex: 9, colorIndex: 99 });
  expect([store.getState().plateIndex, store.getState().colorIndex]).toEqual([3, 0]);
  const two = await setup({ plateIndex: 0, colorIndex: 99 });
  expect(two.store.getState().colorIndex).toBe(2);
});

test('close flushes and clears', async () => {
  const { repo, store, id } = await setup();
  store.getState().next();
  await store.getState().close();
  expect((await repo.load(id)).nav).toEqual({ plateIndex: 0, colorIndex: 1 });
  expect(store.getState().project).toBeNull();
});

test('nav saves only the progress and keep sheet edits made elsewhere', async () => {
  const { repo, store, id } = await setup();
  const disk = await repo.load(id);
  disk.sheet.cells[idx(disk.sheet, 10, 10)] = 9; // 編集画面で塗った
  await repo.save(disk);
  store.getState().next();
  await store.getState().flush();
  const saved = await repo.load(id);
  expect(saved.sheet.cells[idx(saved.sheet, 10, 10)]).toBe(9);
  expect(saved.nav).toEqual({ plateIndex: 0, colorIndex: 1 });
});
