import { createSheet } from '@/core/sheet/sheet';

import { sheetLayout } from './sheetGeometry';

test('29 cells in a 300x400 box → cell 10, 290x290', () => {
  expect(sheetLayout(createSheet(29, 29), 300, 400)).toEqual({ cell: 10, width: 290, height: 290 });
});

test('116 cells in a 300x300 box keeps fractional cells to fill the box', () => {
  const l = sheetLayout(createSheet(116, 116), 300, 300);
  expect(l.cell).toBeCloseTo(300 / 116, 6);
  expect(l.width).toBeCloseTo(300, 6);
});

test('zero-sized box yields zero cell', () => {
  expect(sheetLayout(createSheet(13, 13), 0, 100).cell).toBe(0);
});
