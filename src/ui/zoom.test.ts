import { clampTransform, IDENTITY, pinch, toContent } from './zoom';

test('pinch keeps the midpoint fixed and doubles scale', () => {
  const t = pinch(IDENTITY, { x: 90, y: 100 }, { x: 110, y: 100 }, { x: 80, y: 100 }, { x: 120, y: 100 });
  expect(t.scale).toBeCloseTo(2);
  const mid = toContent(t, { x: 100, y: 100 });
  expect(mid.x).toBeCloseTo(100);
  expect(mid.y).toBeCloseTo(100);
});

test('pinch pans with two fingers moving together', () => {
  const t = pinch({ scale: 2, tx: 0, ty: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 7 }, { x: 15, y: 7 });
  expect(t).toEqual({ scale: 2, tx: 5, ty: 7 });
});

test('clampTransform limits scale to 1..8 and edges', () => {
  expect(clampTransform({ scale: 0.5, tx: 30, ty: 30 }, 300, 300, 300, 300)).toEqual({ scale: 1, tx: 0, ty: 0 });
  expect(clampTransform({ scale: 20, tx: 0, ty: 0 }, 300, 300, 300, 300).scale).toBe(8);
  // 2倍: 内容 600 → 箱 300。tx は -300..0
  expect(clampTransform({ scale: 2, tx: 50, ty: -400 }, 300, 300, 300, 300)).toEqual({ scale: 2, tx: 0, ty: -300 });
});

test('clampTransform centres an axis whose content is smaller than the box', () => {
  // 内容 200x300 を 1倍で 300x300 の箱に → x は中央 (50)
  expect(clampTransform({ scale: 1, tx: 0, ty: 0 }, 200, 300, 300, 300)).toEqual({ scale: 1, tx: 50, ty: 0 });
});

test('toContent inverts the transform', () => {
  expect(toContent({ scale: 2, tx: 10, ty: -20 }, { x: 30, y: 0 })).toEqual({ x: 10, y: 10 });
});

test('pinch past the max scale keeps the content under the fingers (no jump)', () => {
  const t = pinch({ scale: 8, tx: 0, ty: 0 }, { x: 90, y: 100 }, { x: 110, y: 100 }, { x: 80, y: 100 }, { x: 120, y: 100 });
  expect(t.scale).toBe(8);
  const c = toContent(t, { x: 100, y: 100 });
  expect(c.x).toBeCloseTo(100 / 8);
  expect(c.y).toBeCloseTo(100 / 8);
});
