import { applyChanges, floodFill, lineCells, outline, paintCells, rectCells } from './ops';
import { createSheet, idx } from './sheet';
import { sheetFrom } from './testing';

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

test('floodFill is 4-connected', () => {
  const s = sheetFrom([
    [1, 0],
    [0, 1],
  ]);
  expect(floodFill(s, 0, 0, 5)).toEqual([{ i: 0, before: 1, after: 5 }]);
});

test('floodFill on background region', () => {
  const s = sheetFrom([
    [0, 0, 1],
    [0, 1, 0],
  ]);
  expect(sorted(floodFill(s, 0, 0, 4).map((c) => c.i))).toEqual([0, 1, 3]);
});

test('floodFill same value → no changes', () => {
  expect(floodFill(sheetFrom([[2]]), 0, 0, 2)).toEqual([]);
});

test('floodFill does not mutate the sheet', () => {
  const s = sheetFrom([[0, 0]]);
  floodFill(s, 0, 0, 3);
  expect([...s.cells]).toEqual([0, 0]);
});

test('outline thickness 1 paints exterior ring (4-neighbors) only', () => {
  const s = sheetFrom([
    [0, 0, 0],
    [0, 7, 0],
    [0, 0, 0],
  ]);
  const ch = outline(s, 18, 1);
  expect(sorted(ch.map((c) => c.i))).toEqual([1, 3, 5, 7]);
  expect(ch.every((c) => c.before === 0 && c.after === 18)).toBe(true);
});

test('outline thickness 2 grows twice', () => {
  const s = createSheet(5, 5);
  s.cells[idx(s, 2, 2)] = 7;
  expect(outline(s, 18, 2)).toHaveLength(4 + 8);
});

test('outline: object touching edge', () => {
  const s = sheetFrom([
    [7, 0],
    [0, 0],
  ]);
  expect(sorted(outline(s, 18, 1).map((c) => c.i))).toEqual([1, 2]);
});

test('outline: interior hole untouched', () => {
  const s = sheetFrom([
    [0, 0, 0, 0, 0],
    [0, 7, 7, 7, 0],
    [0, 7, 0, 7, 0],
    [0, 7, 7, 7, 0],
    [0, 0, 0, 0, 0],
  ]);
  const ch = outline(s, 18, 1);
  expect(ch.some((c) => c.i === idx(s, 2, 2))).toBe(false);
  expect(ch).toHaveLength(12);
});

test('outline on empty sheet → no changes', () => {
  expect(outline(createSheet(4, 4), 18, 1)).toEqual([]);
});

test('applyChanges forward/backward roundtrip', () => {
  const s = sheetFrom([[1, 2]]);
  const ch = paintCells(
    s,
    [
      [0, 0],
      [1, 0],
      [0, 0],
    ],
    3,
  );
  expect(ch).toHaveLength(2);
  applyChanges(s, ch, 'forward');
  expect([...s.cells]).toEqual([3, 3]);
  applyChanges(s, ch, 'backward');
  expect([...s.cells]).toEqual([1, 2]);
});

test('paintCells skips unchanged and out-of-bounds cells', () => {
  const s = sheetFrom([[3, 0]]);
  expect(
    paintCells(
      s,
      [
        [0, 0],
        [5, 5],
        [1, 0],
      ],
      3,
    ),
  ).toEqual([{ i: 1, before: 0, after: 3 }]);
});

test('rectCells normalizes corners', () => {
  expect(rectCells([1, 1], [0, 0])).toHaveLength(4);
});

test('lineCells covers diagonal endpoints', () => {
  expect(lineCells([0, 0], [3, 3])).toEqual([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
});

test('lineCells single point', () => {
  expect(lineCells([2, 1], [2, 1])).toEqual([[2, 1]]);
});
