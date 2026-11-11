import { plateCell, plateGrid, platesOf, plateSheet } from './plates';
import { createSheet, idx } from './sheet';

test('plateGrid', () => {
  expect(plateGrid(13)).toEqual({ cols: 1, rows: 1 });
  expect(plateGrid(29)).toEqual({ cols: 1, rows: 1 });
  expect(plateGrid(58)).toEqual({ cols: 2, rows: 2 });
  expect(plateGrid(116)).toEqual({ cols: 4, rows: 4 });
});

test('platesOf 116 order is row-major', () => {
  const p = platesOf(createSheet(116, 116));
  expect(p).toHaveLength(16);
  expect(p[1]).toMatchObject({ index: 1, col: 1, row: 0, originX: 29, originY: 0 });
  expect(p[4]).toMatchObject({ index: 4, col: 0, row: 1, originX: 0, originY: 29 });
});

test('13 sheet sits top-left of a 29 plate', () => {
  const s = createSheet(13, 13);
  s.cells[idx(s, 12, 12)] = 5;
  const [pl] = platesOf(s);
  expect(plateCell(s, pl, 12, 12)).toBe(5);
  expect(plateCell(s, pl, 13, 0)).toBe(0);
  expect(plateCell(s, pl, 28, 28)).toBe(0);
});

test('plateSheet extracts a 29x29 plate; outside the sheet is background', () => {
  const s = createSheet(58, 58);
  s.cells[idx(s, 30, 29)] = 7;
  const p = platesOf(s)[3];
  const sub = plateSheet(s, p);
  expect([sub.width, sub.height]).toEqual([29, 29]);
  expect(sub.cells[0 * 29 + 1]).toBe(7);
  const small = createSheet(13, 13);
  small.cells[idx(small, 12, 12)] = 4;
  const sp = plateSheet(small, platesOf(small)[0]);
  expect(sp.cells[12 * 29 + 12]).toBe(4);
  expect(sp.cells[28 * 29 + 28]).toBe(0);
});

test('plateSheet with a row range keeps only those rows', () => {
  const s = createSheet(29, 29);
  s.cells[idx(s, 0, 20)] = 9;
  const sub = plateSheet(s, platesOf(s)[0], [8, 29]);
  expect([sub.width, sub.height]).toEqual([29, 21]);
  expect(sub.cells[12 * 29]).toBe(9);
});
