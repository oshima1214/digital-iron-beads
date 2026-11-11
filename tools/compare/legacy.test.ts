import { PERLER32 } from '../../src/core/palette/perler32';
import { drawRect, solid } from '../../src/core/convert/testing';
import { legacyConvert } from './legacy';

const b = (code: string) => PERLER32.find((x) => x.code === code)!.index;

test('legacy averages a blue/yellow mixed cell into a bead that is neither', () => {
  const img = solid(930, 930, [255, 242, 0, 255]);
  for (let x = 0; x < 930; x += 30) drawRect(img, x, 0, 15, 930, [43, 63, 135, 255]);
  const sh = legacyConvert(img, 29, 32);
  expect([b('5008'), b('5003')]).not.toContain(sh.cells[0]);
});

test('legacy trims near-black border region (V7 behaviour)', () => {
  const img = solid(930, 930, [0, 0, 0, 255]);
  drawRect(img, 300, 300, 330, 330, [221, 8, 8, 255]);
  const sh = legacyConvert(img, 29, 32);
  expect(sh.cells[0]).toBe(b('5005'));
  expect(sh.cells[11 * 29 + 11]).toBe(0); // 330px / 30 = 11 マスより外は背景
});

test('legacy 16-colour mode only uses basic beads', () => {
  const img = solid(930, 930, [196, 30, 58, 255]); // 5059 しゅいろ（拡張色）
  const sh = legacyConvert(img, 29, 16);
  expect(PERLER32[sh.cells[0] - 1].group).toBe('basic');
});
