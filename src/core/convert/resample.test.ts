import { fitToWork } from './resample';
import { solid } from './testing';

test('fitToWork landscape 200x100 into 29', () => {
  const r = fitToWork(solid(200, 100, [255, 0, 0, 255]), 29);
  expect([r.cellsW, r.cellsH]).toEqual([29, 14]);
  expect(r.work.width).toBe(232);
  expect(r.work.height).toBe(112);
  expect([...r.work.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
});

test('fitToWork portrait keeps aspect', () => {
  const r = fitToWork(solid(100, 300, [0, 0, 0, 255]), 21);
  expect([r.cellsW, r.cellsH]).toEqual([7, 21]);
});

test('fitToWork: extreme aspect keeps at least 1 cell', () => {
  const r = fitToWork(solid(3000, 40, [0, 0, 0, 255]), 29);
  expect(r.cellsH).toBeGreaterThanOrEqual(1);
  expect(r.work.height).toBe(r.cellsH * 8);
});

test('fitToWork averages area (checker → mid gray)', () => {
  const img = solid(2, 2, [0, 0, 0, 255]);
  img.data.set([255, 255, 255, 255], 0);
  img.data.set([255, 255, 255, 255], 12);
  const r = fitToWork(img, 13, 1);
  expect(r.cellsW).toBe(13);
  // 縮小方向: 26x26 のチェッカーを 13x13 に（各出力 = 2x2 ブロックの平均）
  const big = solid(26, 26, [0, 0, 0, 255]);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if ((x + y) % 2 === 0) big.data.set([255, 255, 255, 255], (y * 26 + x) * 4);
  const one = fitToWork(big, 13, 1);
  expect(one.work.data[0]).toBeGreaterThan(110);
  expect(one.work.data[0]).toBeLessThan(145);
});
