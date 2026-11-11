import { ALL32 } from '../palette/perler32';
import type { SheetSize } from '../sheet/sheet';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ConvertSettings {
  size: SheetSize;
  preset: 'illust' | 'photo' | 'twoColor';
  allowedBeads: number[];
  maxColors: number;
  noise: 0 | 1 | 2;
  removeBackground: boolean;
  /** OKLab ΔE */
  backgroundTolerance: number;
  lineThreshold: number;
  dither: boolean;
  twoColor?: { dark: number; light: number; threshold: number };
}

export const WORK_CELL_PX = 8;

export function defaultConvertSettings(size: SheetSize = 29): ConvertSettings {
  return {
    size,
    preset: 'illust',
    allowedBeads: [...ALL32],
    maxColors: 32,
    noise: 1,
    removeBackground: true,
    backgroundTolerance: 0.08,
    lineThreshold: 0.15,
    dither: false,
  };
}
