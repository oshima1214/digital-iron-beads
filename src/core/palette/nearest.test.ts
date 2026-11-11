import { srgbToOklab } from '../color/oklab';
import { buildNearestLut, nearestIndex, nearestToOklab } from './nearest';
import { ALL32, PERLER32 } from './perler32';

const beadIdx = (code: string) => PERLER32.find((b) => b.code === code)!.index;

test('every bead maps to itself with ALL32', () => {
  const lut = buildNearestLut(ALL32);
  for (const b of PERLER32) expect(nearestIndex(lut, ...b.rgb)).toBe(b.index);
});

test('restricted set only returns allowed', () => {
  const allowed = [beadIdx('5001'), beadIdx('5018')];
  const lut = buildNearestLut(allowed);
  expect(nearestIndex(lut, 90, 0, 0)).toBe(beadIdx('5018')); // 暗い赤は黒に近い
  expect(nearestIndex(lut, 250, 250, 240)).toBe(beadIdx('5001'));
});

test('single allowed bead maps everything to it', () => {
  const lut = buildNearestLut([7]);
  expect(new Set(lut)).toEqual(new Set([7]));
});

test('lut is cached by allowed set', () => {
  expect(buildNearestLut([2, 1])).toBe(buildNearestLut([1, 2]));
});

test('nearestToOklab exact match', () => {
  expect(nearestToOklab(ALL32, srgbToOklab(221, 8, 8))).toBe(beadIdx('5005'));
});

test('empty allowed set throws', () => {
  expect(() => buildNearestLut([])).toThrow();
});
