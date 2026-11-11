import { PERLER32, ALL32 } from '../palette/perler32';
import { assignCells } from './cells';
import { lineMask } from './lines';
import { drawRect, solid } from './testing';

const beadIdx = (code: string) => PERLER32.find((b) => b.code === code)!.index;
const YELLOW: [number, number, number, number] = [255, 242, 0, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];

test('mode not mean: 5/8 yellow + 3/8 black picks yellow (no line protection)', () => {
  const img = solid(8, 8, YELLOW);
  drawRect(img, 5, 0, 3, 8, BLACK);
  const { cells } = assignCells(img, 1, 1, 8, new Uint8Array(64), null, ALL32, 0.25);
  expect(cells[0]).toBe(beadIdx('5003'));
});

test('cell with >50% background becomes 0', () => {
  const img = solid(8, 8, YELLOW);
  const bg = new Uint8Array(64);
  bg.fill(1, 0, 40);
  const { cells } = assignCells(img, 1, 1, 8, bg, null, ALL32, 0.25);
  expect(cells[0]).toBe(0);
});

test('thin dark line covering >=25% of cell wins via lineCells', () => {
  const img = solid(8, 8, YELLOW);
  drawRect(img, 3, 0, 2, 8, BLACK);
  const bg = new Uint8Array(64);
  const lines = lineMask(img, bg);
  const { cells, lineCells } = assignCells(img, 1, 1, 8, bg, lines, ALL32, 0.25);
  expect(cells[0]).toBe(beadIdx('5018'));
  expect(lineCells[0]).toBe(1);
});

test('without line protection the same cell stays yellow', () => {
  const img = solid(8, 8, YELLOW);
  drawRect(img, 3, 0, 2, 8, BLACK);
  const { cells, lineCells } = assignCells(img, 1, 1, 8, new Uint8Array(64), null, ALL32, 0.25);
  expect(cells[0]).toBe(beadIdx('5003'));
  expect(lineCells[0]).toBe(0);
});

test('lineMask ignores background pixels', () => {
  const img = solid(16, 8, BLACK);
  drawRect(img, 8, 0, 8, 8, YELLOW);
  const bg = new Uint8Array(128);
  for (let y = 0; y < 8; y++) bg.fill(1, y * 16, y * 16 + 8); // 左半分（黒）は背景
  const m = lineMask(img, bg);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) expect(m[y * 16 + x]).toBe(0);
});

test('uniform dark area is not a line', () => {
  const m = lineMask(solid(16, 16, BLACK), new Uint8Array(256));
  expect(m.every((v) => v === 0)).toBe(true);
});

test('multi-cell layout is row-major', () => {
  const img = solid(16, 8, YELLOW);
  drawRect(img, 8, 0, 8, 8, [221, 8, 8, 255]);
  const { cells } = assignCells(img, 2, 1, 8, new Uint8Array(128), null, ALL32, 0.25);
  expect([...cells]).toEqual([beadIdx('5003'), beadIdx('5005')]);
});
