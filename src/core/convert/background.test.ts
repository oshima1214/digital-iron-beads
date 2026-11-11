import { backgroundMask } from './background';
import { drawRect, solid } from './testing';

test('alpha < 128 is background regardless of flag', () => {
  const img = solid(4, 4, [255, 0, 0, 255]);
  img.data[3] = 0;
  expect(backgroundMask(img, false, 0.08)[0]).toBe(1);
  expect(backgroundMask(img, false, 0.08)[1]).toBe(0);
});

test('border-connected similar color is background when enabled', () => {
  const img = solid(10, 10, [250, 250, 250, 255]);
  drawRect(img, 3, 3, 4, 4, [255, 0, 0, 255]);
  const m = backgroundMask(img, true, 0.08);
  expect(m[0]).toBe(1);
  expect(m[5 * 10 + 5]).toBe(0);
  expect(backgroundMask(img, false, 0.08)[0]).toBe(0);
});

test('backgroundMask: dark outline not connected to border survives', () => {
  const img = solid(12, 12, [0, 0, 0, 255]);
  drawRect(img, 2, 2, 8, 8, [255, 255, 0, 255]);
  drawRect(img, 4, 4, 4, 4, [0, 0, 0, 255]);
  const m = backgroundMask(img, true, 0.08);
  expect(m[0]).toBe(1);
  expect(m[5 * 12 + 5]).toBe(0);
});

test('object touching the image edge is not treated as background', () => {
  const img = solid(20, 20, [255, 255, 255, 255]);
  drawRect(img, 0, 6, 8, 8, [221, 8, 8, 255]); // 左端に接する赤い四角
  const m = backgroundMask(img, true, 0.08);
  expect(m[10 * 20 + 0]).toBe(0);
  expect(m[10 * 20 + 4]).toBe(0);
  expect(m[0]).toBe(1);
});
