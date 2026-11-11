import type { Rgb } from '../color/oklab';
import type { Bead } from './types';

// legacy/DigitalIronBeadsV7_colab.py の perler_basic_16 / perler_extended_16 と同じ値・同じ順序。
const BASIC: [string, string, Rgb][] = [
  ['5001', 'しろ', [255, 255, 255]],
  ['5003', 'きいろ', [255, 242, 0]],
  ['5005', 'あか', [221, 8, 8]],
  ['5006', 'ピンク', [255, 111, 152]],
  ['5008', 'あお', [43, 63, 135]],
  ['5009', 'みずいろ', [88, 171, 229]],
  ['5010', 'みどり', [53, 150, 63]],
  ['5018', 'くろ', [0, 0, 0]],
  ['5004', 'オレンジ', [255, 123, 0]],
  ['5007', 'むらさき', [112, 59, 155]],
  ['5017', 'はいいろ', [138, 141, 145]],
  ['5020', 'ちゃいろ', [113, 71, 42]],
  ['5033', 'ビーチ', [242, 193, 145]],
  ['5061', 'きみどり', [193, 228, 64]],
  ['5070', 'あおむらさき', [95, 82, 139]],
  ['5098', 'アプリコット', [253, 175, 130]],
];

const EXTENDED: [string, string, Rgb][] = [
  ['5002', 'クリーム', [255, 243, 194]],
  ['5012', 'こげちゃいろ', [74, 46, 28]],
  ['5021', 'おうどいろ', [204, 187, 154]],
  ['5059', 'しゅいろ', [196, 30, 58]],
  ['5060', 'ぶどういろ', [134, 75, 122]],
  ['5091', 'あおみどり', [0, 131, 127]],
  ['5092', 'ダークグレイ', [77, 81, 86]],
  ['5097', 'マスカット', [168, 213, 155]],
  ['5011', 'うぐいすいろ', [108, 119, 64]],
  ['5019', 'とうめい', [230, 230, 230]],
  ['5035', 'こむぎいろ', [228, 172, 106]],
  ['5038', 'マゼンタ', [228, 0, 124]],
  ['5057', 'やまぶきいろ', [242, 186, 0]],
  ['5058', 'スカイブルー', [118, 200, 238]],
  ['5079', 'さくらいろ', [255, 205, 216]],
  ['5089', 'オーシャンブルー', [0, 102, 153]],
];

export const PERLER32: readonly Bead[] = [
  ...BASIC.map(([code, name, rgb], i): Bead => ({ index: i + 1, code, name, rgb, group: 'basic' })),
  ...EXTENDED.map(([code, name, rgb], i): Bead => ({ index: i + 17, code, name, rgb, group: 'extended' })),
];

export const BASIC16: readonly number[] = PERLER32.filter((b) => b.group === 'basic').map((b) => b.index);
export const ALL32: readonly number[] = PERLER32.map((b) => b.index);

export function beadByIndex(i: number): Bead {
  const b = PERLER32[i - 1];
  if (!b || b.index !== i) throw new RangeError(`bead index out of range: ${i}`);
  return b;
}
