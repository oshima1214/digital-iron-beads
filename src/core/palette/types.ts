import type { Rgb } from '../color/oklab';

/** perler-32 は 64色にする前の作品。番号 1〜32 は同じ色なので、そのまま読める。 */
export type PaletteId = 'perler-32' | 'perler-64';

/** 色の系統（手持ちを選ぶ画面の並び） */
export type BeadFamily = 'mono' | 'red' | 'yellow' | 'brown' | 'green' | 'blue' | 'purple';

export interface Bead {
  /** 1..64。0 は背景のため使わない。 */
  index: number;
  /** カワダの単色の品番（5001、80-15269K など） */
  code: string;
  name: string;
  rgb: Rgb;
  /** basic = 元のアプリの基本16色、extended = 追加の16色、more = 手持ち用に足した32色 */
  group: 'basic' | 'extended' | 'more';
  family: BeadFamily;
}

/**
 * 使うビーズ。
 *   original = 元の色（ビーズに変える前の色で見るだけ。作品にはできない）
 *   8 / 16 / 32 = 決まった組み合わせ、owned = 手持ち（設定に保存）
 */
export type BeadSet = 'original' | '8' | '16' | '32' | 'owned';
