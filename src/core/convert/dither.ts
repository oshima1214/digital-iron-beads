import { srgbToOklab } from '../color/oklab';
import { nearestToOklab } from '../palette/nearest';
import { beadByIndex } from '../palette/perler32';
import { mapCellMeans } from './twoColor';
import type { RgbaImage } from './types';

/** マスの平均色に対し、OKLab 上で Floyd–Steinberg 誤差拡散。背景マスには誤差を流さない。 */
export function ditherCells(
  work: RgbaImage,
  cellsW: number,
  cellsH: number,
  cellPx: number,
  bg: Uint8Array,
  allowed: readonly number[],
): Uint8Array {
  const n = cellsW * cellsH;
  const lab = new Float64Array(n * 3);
  const present = mapCellMeans(work, cellsW, cellsH, cellPx, bg, (r, g, b, ci) => {
    const c = srgbToOklab(r, g, b);
    lab[ci * 3] = c[0];
    lab[ci * 3 + 1] = c[1];
    lab[ci * 3 + 2] = c[2];
    return 1;
  });
  const out = new Uint8Array(n);
  const spread = (x: number, y: number, e: number[], k: number) => {
    if (x < 0 || x >= cellsW || y >= cellsH) return;
    const j = y * cellsW + x;
    if (!present[j]) return;
    for (let c = 0; c < 3; c++) lab[j * 3 + c] += e[c] * k;
  };
  for (let y = 0; y < cellsH; y++) {
    for (let x = 0; x < cellsW; x++) {
      const i = y * cellsW + x;
      if (!present[i]) continue;
      const cur: [number, number, number] = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
      const pick = nearestToOklab(allowed, cur);
      out[i] = pick;
      const p = srgbToOklab(...beadByIndex(pick).rgb);
      const e = [cur[0] - p[0], cur[1] - p[1], cur[2] - p[2]];
      spread(x + 1, y, e, 7 / 16);
      spread(x - 1, y + 1, e, 3 / 16);
      spread(x, y + 1, e, 5 / 16);
      spread(x + 1, y + 1, e, 1 / 16);
    }
  }
  return out;
}
