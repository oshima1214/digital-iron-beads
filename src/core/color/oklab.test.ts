import { oklabDist2, srgbToOklab } from './oklab';

test('srgbToOklab red', () => {
  const [L, a, b] = srgbToOklab(255, 0, 0);
  expect(L).toBeCloseTo(0.627955, 4);
  expect(a).toBeCloseTo(0.224863, 4);
  expect(b).toBeCloseTo(0.125846, 4);
});

test('srgbToOklab white/black', () => {
  expect(srgbToOklab(255, 255, 255)[0]).toBeCloseTo(1, 3);
  expect(srgbToOklab(0, 0, 0)[0]).toBeCloseTo(0, 6);
});

test('oklabDist2 is squared euclidean', () => {
  expect(oklabDist2([0, 0, 0], [1, 2, 2])).toBeCloseTo(9, 10);
});
