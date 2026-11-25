import { defaultConvertSettings } from '@/core/convert/types';
import { createProject } from '@/core/file/project';
import { PERLER32 } from '@/core/palette/perler';
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

test('leaving and re-entering the sheet does not paint a chord across it', async () => {
  const { store } = await setup();
  const st = store.getState();
  st.setColor(RED);
  st.strokeBegin([12, 0]);
  st.strokeMove(null);
  st.strokeMove([0, 12]);
  st.strokeEnd();
  expect(cellsOf(store).cells.filter((v) => v === RED)).toHaveLength(2);
});

test('range mode: two taps select the rectangle between them', async () => {
  const { store } = await setup((c) => c.fill(RED));
  const st = () => store.getState();
  st().setTool('select');
  st().setRangeMode(true);
  st().tapSelect([1, 1]);
  st().rangeEnd();
  expect(st().selection.size).toBe(0);
  expect(st().range).toEqual([[1, 1], [1, 1]]);
  st().tapSelect([3, 2]);
  st().rangeEnd();
  expect(st().selection.size).toBe(6);
  expect(st().range).toBeNull();
});

test('committed changes only when an edit is committed, not on every stroke cell', async () => {
  const { store } = await setup();
  const st = store.getState();
  const c0 = store.getState().committed;
  st.setColor(RED);
  st.strokeBegin([0, 0]);
  st.strokeMove([3, 0]);
  expect(store.getState().committed).toBe(c0);
  st.strokeEnd();
  expect(store.getState().committed).toBe(c0 + 1);
});

test('editor saves never overwrite nav progress written by the nav screen', async () => {
  const { repo, store, id } = await setup();
  // ナビ画面が進み具合を保存した（編集ストアの project.nav は古いまま）
  const disk = await repo.load(id);
  await repo.save({ ...disk, nav: { plateIndex: 0, colorIndex: 3 } });
  store.getState().setColor(RED);
  store.getState().strokeBegin([1, 1]);
  store.getState().strokeEnd();
  await store.getState().flush();
  const saved = await repo.load(id);
  expect(saved.nav).toEqual({ plateIndex: 0, colorIndex: 3 });
  expect(saved.sheet.cells[idx(saved.sheet, 1, 1)]).toBe(RED);
});

test('pen and eraser use their own brush size', async () => {
  const sizes = { pen: 3, eraser: 1 };
  const repo = createMemoryRepo();
  const p = createProject('作品', createSheet(13, 13), new Date('2026-11-10T00:00:00Z'));
  await repo.save(p);
  const store = createEditorStore(repo, () => new Date('2026-11-11T00:00:00Z'), 500, (t) => sizes[t]);
  await store.getState().open(p.id);
  const st = store.getState();
  st.setColor(RED);
  st.strokeBegin([5, 5]);
  st.strokeMove([7, 5]);
  st.strokeEnd();
  // 3×3 のペンで (5,5)→(7,5)：x 4..8, y 4..6 の 15 マス
  expect(cellsOf(store).cells.filter((v) => v === RED)).toHaveLength(15);
  st.setTool('eraser');
  st.strokeBegin([6, 5]);
  st.strokeEnd();
  expect(at(store, 6, 5)).toBe(0);
  expect(at(store, 5, 5)).toBe(RED);
  store.getState().undo();
  expect(at(store, 6, 5)).toBe(RED);
  store.getState().undo();
  expect(cellsOf(store).cells.filter((v) => v === RED)).toHaveLength(0);
});

test('bucket on a region that already has the color leaves a notice instead of silently doing nothing', async () => {
  const { store } = await setup((c) => c.fill(RED));
  const st = () => store.getState();
  st().setTool('bucket');
  st().setColor(RED);
  st().bucket([3, 3]);
  expect(st().notice).toBe('same-color');
  expect(st().canUndo).toBe(false);
  st().setColor(YELLOW);
  expect(st().notice).toBeNull();
  st().bucket([3, 3]);
  expect(st().notice).toBeNull();
  expect(at(store, 0, 0)).toBe(YELLOW);
});

test('setName renames the open work (trimmed, autosaved); blank is ignored', async () => {
  const { repo, store, id } = await setup();
  store.getState().setName('  ねこ ');
  expect(store.getState().project?.name).toBe('ねこ');
  store.getState().setName('  ');
  expect(store.getState().project?.name).toBe('ねこ');
  await jest.advanceTimersByTimeAsync(600);
  expect((await repo.load(id)).name).toBe('ねこ');
});

test('opening a 16-color work picks a color from those 16', async () => {
  const repo = createMemoryRepo();
  const p = createProject('作品', createSheet(13, 13), new Date('2026-11-10T00:00:00Z'));
  p.source = { image: 'source.png', brightness: 0, contrast: 0, convert: { ...defaultConvertSettings(13), preset: 'twoColor', twoColor: { dark: 8, light: 1, threshold: 0.5 } } };
  await repo.save(p);
  const store = createEditorStore(repo);
  await store.getState().open(p.id);
  expect([1, 8]).toContain(store.getState().color); // 空のシートでも、黒（5018）ではなく2色のどちらか
});

// ホームに戻ると close が走る。保存を待っているあいだに同じ作品を開き直しても、閉じる処理が後から作品を消さない
test('ensureOpen while close is still saving keeps the work open', async () => {
  const { store, id } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin([3, 3]);
  store.getState().strokeEnd();
  const closing = store.getState().close();
  const opening = store.getState().ensureOpen(id);
  await Promise.all([closing, opening]);
  expect(store.getState().project?.id).toBe(id);
  expect(at(store, 3, 3)).toBe(RED);
});

// 後から呼んだほうが勝つ：開いている途中で閉じたら、読み終わっても開かない
test('close after open started wins', async () => {
  const { repo, store } = await setup();
  const other = createProject('別', createSheet(13, 13), new Date('2026-11-10T00:00:00Z'));
  await repo.save(other);
  const opening = store.getState().open(other.id);
  const closing = store.getState().close();
  await Promise.all([opening, closing]);
  expect(store.getState().project).toBeNull();
});

test('open after close started wins', async () => {
  const { repo, store } = await setup();
  const other = createProject('別', createSheet(13, 13), new Date('2026-11-10T00:00:00Z'));
  await repo.save(other);
  const closing = store.getState().close();
  const opening = store.getState().open(other.id);
  await Promise.all([closing, opening]);
  expect(store.getState().project?.id).toBe(other.id);
});

test('ensureOpen does not reload a work that is already open', async () => {
  const { store, id } = await setup();
  store.getState().setColor(RED);
  store.getState().strokeBegin([3, 3]);
  store.getState().strokeEnd();
  await store.getState().ensureOpen(id);
  expect(store.getState().canUndo).toBe(true);
});
