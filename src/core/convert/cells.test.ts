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

test('lineMask detects a light, colored thin line blended with white (L > 0.5)', () => {
  const img = solid(24, 24, [255, 255, 255, 255]);
  drawRect(img, 11, 0, 2, 24, [147, 157, 207, 255]); // 青い線が白と半分混ざった色
  const m = lineMask(img, new Uint8Array(24 * 24), undefined, 8);
  expect(m[12 * 24 + 11]).toBe(1);
  expect(m[12 * 24 + 2]).toBe(0);
});

test('line cell color comes from the darkest line pixels, not blended ones', () => {
  const img = solid(8, 8, YELLOW);
  drawRect(img, 2, 0, 1, 8, BLACK);
  drawRect(img, 3, 0, 2, 8, [128, 121, 0, 255]); // 黒と黄色の中間（オリーブ）2列
  const bg = new Uint8Array(64);
  const lines = lineMask(img, bg, undefined, 8);
  const { cells } = assignCells(img, 1, 1, 8, bg, lines, ALL32, 0.12);
  expect(cells[0]).toBe(beadIdx('5018'));
});

test('gap between two line cells is bridged when it has some line pixels', () => {
  // 3マス横並び: 左右は太い黒線、中央はごく細い黒線（1/8 列の半分）
  const img = solid(24, 8, YELLOW);
  drawRect(img, 0, 3, 8, 3, BLACK);
  drawRect(img, 16, 3, 8, 3, BLACK);
  drawRect(img, 8, 4, 8, 1, [60, 60, 60, 255]);
  const bg = new Uint8Array(24 * 8);
  const lines = lineMask(img, bg, undefined, 8);
  const { cells, lineCells } = assignCells(img, 3, 1, 8, bg, lines, ALL32, 0.3);
  expect(lineCells[0]).toBe(1);
  expect(lineCells[2]).toBe(1);
  expect(lineCells[1]).toBe(1);
  expect(cells[1]).toBe(beadIdx('5018'));
});

test('thin line crossing a mostly-background cell still becomes a line cell', () => {
  const img = solid(24, 24, [255, 255, 255, 255]);
  drawRect(img, 0, 11, 24, 2, [40, 60, 160, 255]); // 2px の青い横線
  const bg = new Uint8Array(24 * 24);
  for (let i = 0; i < bg.length; i++) if (img.data[i * 4] === 255) bg[i] = 1; // 白は背景
  const lines = lineMask(img, bg, undefined, 8);
  const { cells, lineCells } = assignCells(img, 3, 3, 8, bg, lines, ALL32, 0.12);
  expect([cells[3], cells[4], cells[5]]).toEqual([beadIdx('5008'), beadIdx('5008'), beadIdx('5008')]);
  expect(lineCells[4]).toBe(1);
  expect(cells[0]).toBe(0);
});
