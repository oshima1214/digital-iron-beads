import type { Rgb } from '../color/oklab';

export type PaletteId = 'perler-32';

export interface Bead {
  /** 1..32。0 は背景のため使わない。 */
  index: number;
  code: string;
  name: string;
  rgb: Rgb;
  group: 'basic' | 'extended';
}
