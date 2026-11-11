import { drawRect, solid } from '../convert/testing';
import { adjustImage, clampCrop, cropImage, resizeMax } from './adjust';

test('clampCrop keeps rect inside image and at least 8px', () => {
  expect(clampCrop({ x: -10, y: 5, w: 50, h: 2 }, 40, 40)).toEqual({ x: 0, y: 5, w: 40, h: 8 });
  expect(clampCrop({ x: 39, y: 39, w: 20, h: 20 }, 40, 40)).toEqual({ x: 32, y: 32, w: 8, h: 8 });
});

test('clampCrop on an image smaller than the minimum uses the whole image', () => {
  expect(clampCrop({ x: 0, y: 0, w: 1, h: 1 }, 5, 3)).toEqual({ x: 0, y: 0, w: 5, h: 3 });
});

test('cropImage copies the sub-rectangle', () => {
  const img = solid(4, 4, [0, 0, 0, 255]);
  drawRect(img, 0, 0, 2, 2, [255, 0, 0, 255]);
  const c = cropImage(img, { x: 0, y: 0, w: 2, h: 2 });
  expect([c.width, c.height]).toEqual([2, 2]);
  for (let i = 0; i < 4; i++) expect([...c.data.slice(i * 4, i * 4 + 4)]).toEqual([255, 0, 0, 255]);
});

test('adjustImage 0/0 is an identical copy', () => {
  const img = solid(1, 1, [100, 50, 200, 77]);
  const a = adjustImage(img, 0, 0);
  expect(a).not.toBe(img);
  expect([...a.data]).toEqual([100, 50, 200, 77]);
});

test('adjustImage brightness +100 makes white, contrast -100 makes mid gray, alpha kept', () => {
  expect([...adjustImage(solid(1, 1, [100, 50, 200, 77]), 100, 0).data]).toEqual([255, 255, 255, 77]);
  expect([...adjustImage(solid(1, 1, [10, 200, 90, 255]), 0, -100).data]).toEqual([128, 128, 128, 255]);
});

test('resizeMax downsizes long side and keeps aspect', () => {
  const r = resizeMax(solid(4000, 1000, [1, 2, 3, 255]), 2048);
  expect([r.width, r.height]).toEqual([2048, 512]);
  expect([...r.data.slice(0, 4)]).toEqual([1, 2, 3, 255]);
  const small = solid(100, 50, [0, 0, 0, 255]);
  expect(resizeMax(small, 2048)).toBe(small);
});
