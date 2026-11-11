import { srgbToOklab } from '../color/oklab';
import type { RgbaImage } from './types';

/** マス内（背景以外）の平均色の L が threshold 以下なら dark、それ以外は light。背景が過半なら 0。 */
export function twoColorCells(
  work: RgbaImage,
  cellsW: number,
  cellsH: number,
  cellPx: number,
  bg: Uint8Array,
  dark: number,
  light: number,
  threshold: number,
): Uint8Array {
  return mapCellMeans(work, cellsW, cellsH, cellPx, bg, (r, g, b) => (srgbToOklab(r, g, b)[0] <= threshold ? dark : light));
}

/** マスごとに背景以外のピクセルの平均 sRGB を求めて f で値にする。背景が過半のマスは 0。 */
export function mapCellMeans(
  work: RgbaImage,
  cellsW: number,
  cellsH: number,
  cellPx: number,
  bg: Uint8Array,
  f: (r: number, g: number, b: number, ci: number) => number,
): Uint8Array {
  const out = new Uint8Array(cellsW * cellsH);
  const { width: w, data } = work;
  const area = cellPx * cellPx;
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const i = y * w + x;
          if (bg[i]) continue;
          r += data[i * 4];
          g += data[i * 4 + 1];
          b += data[i * 4 + 2];
          n++;
        }
      }
      const ci = cy * cellsW + cx;
      if (n * 2 < area || n === 0) continue;
      out[ci] = f(r / n, g / n, b / n, ci);
    }
  }
  return out;
}
