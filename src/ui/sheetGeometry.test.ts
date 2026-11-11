import { createSheet } from '@/core/sheet/sheet';

import { sheetLayout, viewToCell } from './sheetGeometry';

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

test('viewToCell maps pixels to cells', () => {
  expect(viewToCell(25, 5, createSheet(13, 13), 10, false)).toEqual([2, 0]);
  expect(viewToCell(129.9, 129.9, createSheet(13, 13), 10, false)).toEqual([12, 12]);
});

test('viewToCell mirrors x', () => {
  expect(viewToCell(5, 5, createSheet(13, 13), 10, true)).toEqual([12, 0]);
});

test('viewToCell returns null outside', () => {
  expect(viewToCell(-1, 5, createSheet(13, 13), 10, false)).toBeNull();
  expect(viewToCell(130, 5, createSheet(13, 13), 10, false)).toBeNull();
  expect(viewToCell(5, 5, createSheet(13, 13), 0, false)).toBeNull();
});
