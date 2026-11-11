import { platesOf, plateCell, plateGrid } from './plates';
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
