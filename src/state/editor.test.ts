import { createProject } from '@/core/file/project';
import { PERLER32 } from '@/core/palette/perler32';
import { createSheet, idx } from '@/core/sheet/sheet';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { createEditorStore } from './editor';

const b = (code: string) => PERLER32.find((x) => x.code === code)!.index;
const RED = b('5005');
const YELLOW = b('5003');
const BLACK = b('5018');

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function setup(fill?: (cells: Uint8Array) => void) {
  const repo = createMemoryRepo();
  const sheet = createSheet(13, 13);
  fill?.(sheet.cells);
  const p = createProject('作品', sheet, new Date('2026-11-10T00:00:00Z'));
  await repo.save(p);
  const store = createEditorStore(repo, () => new Date('2026-11-11T00:00:00Z'));
  await store.getState().open(p.id);
  return { repo, store, id: p.id };
}

const cellsOf = (s: ReturnType<typeof createEditorStore>) => s.getState().project!.sheet;
const at = (s: ReturnType<typeof createEditorStore>, x: number, y: number) => cellsOf(s).cells[idx(cellsOf(s), x, y)];

test('stroke paints and is one undo step', async () => {
  const { store } = await setup();
  const st = store.getState();
  st.setColor(RED);
  st.strokeBegin([0, 0]);
  st.strokeMove([1, 0]);
  st.strokeMove([1, 1]);
  st.strokeEnd();
  expect([at(store, 0, 0), at(store, 1, 0), at(store, 1, 1)]).toEqual([RED, RED, RED]);
  const v = store.getState().version;
  store.getState().undo();
  expect([at(store, 0, 0), at(store, 1, 0), at(store, 1, 1)]).toEqual([0, 0, 0]);
  expect(store.getState().version).toBeGreaterThan(v);
  expect(store.getState().canUndo).toBe(false);
});

test('stroke interpolates skipped cells', async () => {
  const { store } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin([0, 0]);
  store.getState().strokeMove([4, 0]);
  store.getState().strokeEnd();
  expect([0, 1, 2, 3, 4].map((x) => at(store, x, 0))).toEqual([RED, RED, RED, RED, RED]);
});

test('stroke ignores outside points and resumes inside', async () => {
  const { store } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin(null);
  store.getState().strokeMove(null);
  store.getState().strokeMove([2, 2]);
  store.getState().strokeMove([3, 2]);
  store.getState().strokeEnd();
  expect([at(store, 2, 2), at(store, 3, 2), at(store, 0, 0)]).toEqual([RED, RED, 0]);
});

test('eraser sets 0', async () => {
  const { store } = await setup((c) => c.fill(RED));
  store.getState().setTool('eraser');
  store.getState().strokeBegin([5, 5]);
  store.getState().strokeEnd();
  expect(at(store, 5, 5)).toBe(0);
});

test('bucket fills connected region and undo restores', async () => {
  const { store } = await setup();
  store.getState().setTool('bucket');
  store.getState().setColor(YELLOW);
  store.getState().bucket([10, 10]);
  expect(cellsOf(store).cells.every((v) => v === YELLOW)).toBe(true);
  store.getState().undo();
  expect(cellsOf(store).cells.every((v) => v === 0)).toBe(true);
});

test('tapSelect toggles; range select; recolor/delete apply, clear selection, one undo step each', async () => {
  const { store } = await setup((c) => c.fill(RED));
  const st = () => store.getState();
  st().setTool('select');
  st().tapSelect([0, 0]);
  st().tapSelect([1, 0]);
  st().tapSelect([1, 0]);
  expect([...st().selection]).toEqual([0]);
  st().setColor(YELLOW);
  st().recolorSelection();
  expect(at(store, 0, 0)).toBe(YELLOW);
  expect(st().selection.size).toBe(0);
  st().setRangeMode(true);
  st().tapSelect([2, 2]);
  st().rangeMove([4, 3]);
  st().rangeEnd();
  expect(st().selection.size).toBe(6);
  expect(st().range).toBeNull();
  st().deleteSelection();
  expect([at(store, 2, 2), at(store, 4, 3), at(store, 5, 3)]).toEqual([0, 0, RED]);
  st().undo();
  expect(at(store, 2, 2)).toBe(RED);
  st().undo();
  expect(at(store, 0, 0)).toBe(RED);
});

test('outline uses current color with thickness', async () => {
  const { store } = await setup((c) => (c[idx(createSheet(13, 13), 6, 6)] = RED));
  store.getState().setColor(BLACK);
  store.getState().applyOutline(1);
  expect([at(store, 5, 6), at(store, 7, 6), at(store, 6, 5), at(store, 6, 7), at(store, 5, 5)]).toEqual([BLACK, BLACK, BLACK, BLACK, 0]);
});

test('redo after undo; new edit clears redo', async () => {
  const { store } = await setup();
  const st = () => store.getState();
  st().setColor(RED);
  st().strokeBegin([0, 0]);
  st().strokeEnd();
  st().undo();
  expect(st().canRedo).toBe(true);
  st().redo();
  expect(at(store, 0, 0)).toBe(RED);
  st().undo();
  st().strokeBegin([1, 1]);
  st().strokeEnd();
  expect(st().canRedo).toBe(false);
});

test('edits autosave after 500ms', async () => {
  const { repo, store, id } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin([3, 3]);
  store.getState().strokeEnd();
  expect((await repo.load(id)).sheet.cells[idx(createSheet(13, 13), 3, 3)]).toBe(0);
  await jest.advanceTimersByTimeAsync(500);
  const saved = await repo.load(id);
  expect(saved.sheet.cells[idx(saved.sheet, 3, 3)]).toBe(RED);
  expect(saved.updatedAt).toBe('2026-11-11T00:00:00.000Z');
});

test('undo then close saves the undone state', async () => {
  const { repo, store, id } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin([3, 3]);
  store.getState().strokeEnd();
  await jest.advanceTimersByTimeAsync(500);
  store.getState().undo();
  await store.getState().close();
  const saved = await repo.load(id);
  expect(saved.sheet.cells[idx(saved.sheet, 3, 3)]).toBe(0);
  expect(store.getState().project).toBeNull();
});

test('open of missing project sets error', async () => {
  const store = createEditorStore(createMemoryRepo());
  await store.getState().open('nope');
  expect(store.getState().error).toBe('open-failed');
});

test('initial color is the most used bead, black when empty', async () => {
  const { store } = await setup((c) => {
    c.fill(YELLOW, 0, 10);
    c.fill(RED, 10, 12);
  });
  expect(store.getState().color).toBe(YELLOW);
  const empty = await setup();
  expect(empty.store.getState().color).toBe(BLACK);
});
