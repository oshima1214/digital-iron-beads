import { ALL32 } from '../palette/perler';
import type { BeadSet } from '../palette/types';
import type { SheetSize } from '../sheet/sheet';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ConvertSettings {
  size: SheetSize;
  preset: 'illust' | 'photo' | 'twoColor';
  /** 使うビーズの組み合わせ。original のときは元の色で見るだけ（allowedBeads は使わない） */
  beadSet: BeadSet;
  /** 変換に使うビーズの番号（beadSet から決まる。手持ちは選んだときの一覧を写す） */
  allowedBeads: number[];
  noise: 0 | 1 | 2;
  removeBackground: boolean;
  /** OKLab ΔE */
  backgroundTolerance: number;
  lineThreshold: number;
  twoColor?: { dark: number; light: number; threshold: number };
}

export const WORK_CELL_PX = 8;

export function defaultConvertSettings(size: SheetSize = 29): ConvertSettings {
  return {
    size,
    preset: 'illust',
    beadSet: 'original',
    allowedBeads: [...ALL32],
    noise: 1,
    removeBackground: true,
    backgroundTolerance: 0.08,
    lineThreshold: 0.15,
  };
}
