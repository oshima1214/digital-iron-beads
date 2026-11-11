import { PERLER32 } from '../palette/perler32';
import { countBeads } from '../sheet/counts';
import { convertImage } from './convert';
import { drawRect, noiseImage, solid } from './testing';
import { defaultConvertSettings } from './types';

const b = (code: string) => PERLER32.find((x) => x.code === code)!.index;

test('convertImage: fully transparent → empty sheet', () => {
  const sh = convertImage(solid(50, 50, [0, 0, 0, 0]), defaultConvertSettings(29));
  expect(sh.width).toBe(29);
  expect(sh.height).toBe(29);
  expect(sh.cells.every((v) => v === 0)).toBe(true);
  expect(countBeads(sh)).toEqual([]);
});

test('convertImage: single allowed bead', () => {
  const s = { ...defaultConvertSettings(13), allowedBeads: [b('5005')], removeBackground: false };
  const sh = convertImage(solid(40, 40, [0, 0, 255, 255]), s);
  expect(new Set(sh.cells)).toEqual(new Set([b('5005')]));
});

test('convertImage: area outside the fitted image is background', () => {
  const s = { ...defaultConvertSettings(29), removeBackground: false };
  const sh = convertImage(solid(200, 100, [221, 8, 8, 255]), s); // 29x14
  expect(sh.cells[0]).toBe(b('5005'));
  expect(sh.cells[20 * 29]).toBe(0);
});

test('convertImage: respects maxColors', () => {
  const img = solid(80, 80, [221, 8, 8, 255]);
  drawRect(img, 20, 0, 20, 80, [43, 63, 135, 255]);
  drawRect(img, 40, 0, 20, 80, [53, 150, 63, 255]);
  drawRect(img, 60, 0, 20, 80, [255, 242, 0, 255]);
  const sh = convertImage(img, { ...defaultConvertSettings(13), maxColors: 2, removeBackground: false });
  expect(countBeads(sh).length).toBeLessThanOrEqual(2);
});

test('convertImage: removes plain background around an object', () => {
  const img = solid(80, 80, [255, 255, 255, 255]);
  drawRect(img, 20, 20, 40, 40, [221, 8, 8, 255]);
  const sh = convertImage(img, defaultConvertSettings(13));
  expect(sh.cells[0]).toBe(0);
  expect(sh.cells[6 * 13 + 6]).toBe(b('5005'));
});

test('convertImage: twoColor preset uses only dark/light', () => {
  const img = solid(64, 64, [0, 0, 0, 255]);
  for (let x = 0; x < 64; x++) drawRect(img, x, 0, 1, 64, [x * 4, x * 4, x * 4, 255]);
  const s = {
    ...defaultConvertSettings(13),
    preset: 'twoColor' as const,
    removeBackground: false,
    twoColor: { dark: b('5018'), light: b('5003'), threshold: 0.5 },
  };
  const sh = convertImage(img, s);
  expect(new Set(sh.cells)).toEqual(new Set([b('5018'), b('5003')]));
  expect(sh.cells[0]).toBe(b('5018'));
  expect(sh.cells[12]).toBe(b('5003'));
});

test('convertImage: photo + dither mixes black and white for mid gray', () => {
  const s = {
    ...defaultConvertSettings(13),
    preset: 'photo' as const,
    dither: true,
    noise: 0 as const,
    removeBackground: false,
    allowedBeads: [b('5001'), b('5018')],
  };
  const counts = countBeads(convertImage(solid(52, 52, [99, 99, 99, 255]), s));
  expect(counts).toHaveLength(2);
  expect(Math.min(...counts.map((c) => c.count))).toBeGreaterThan(30);
});

test('convertImage 116 performance', () => {
  const img = noiseImage(1600, 1600);
  const t = Date.now();
  convertImage(img, defaultConvertSettings(116));
  expect(Date.now() - t).toBeLessThan(4000);
});
