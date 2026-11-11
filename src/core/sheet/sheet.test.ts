import { cloneSheet, createSheet, getCell, idx, inBounds } from './sheet';

test('createSheet is empty perler-32', () => {
  const s = createSheet(3, 2);
  expect(s.cells).toHaveLength(6);
  expect(s.cells.every((v) => v === 0)).toBe(true);
  expect(s.paletteId).toBe('perler-32');
});

test('getCell out of bounds is 0, idx is row-major', () => {
  const s = createSheet(3, 2);
  s.cells[idx(s, 2, 1)] = 4;
  expect(idx(s, 2, 1)).toBe(5);
  expect(getCell(s, 2, 1)).toBe(4);
  expect(getCell(s, -1, 0)).toBe(0);
  expect(inBounds(s, 3, 0)).toBe(false);
});

test('cloneSheet copies cells', () => {
  const s = createSheet(1, 1);
  const c = cloneSheet(s);
  c.cells[0] = 2;
  expect(s.cells[0]).toBe(0);
});
