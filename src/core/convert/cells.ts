import { oklabDist2, srgbToOklab } from '../color/oklab';
import { buildNearestLut, nearestIndex } from '../palette/nearest';
import { beadByIndex } from '../palette/perler32';
import type { RgbaImage } from './types';

/**
 * マスごとの代表色。
 * 1. 背景ピクセルが 50% を超えるマスは 0
 * 2. lines があり、線ピクセルが lineThreshold 以上なら線ピクセルだけを対象にし lineCells=1
 * 3. 対象ピクセルを最近傍ビーズに置き換えた最頻値。同数は対象の平均色に近い方
 */
export function assignCells(
  work: RgbaImage,
  cellsW: number,
  cellsH: number,
  cellPx: number,
  bg: Uint8Array,
  lines: Uint8Array | null,
  allowed: readonly number[],
  lineThreshold: number,
): { cells: Uint8Array; lineCells: Uint8Array } {
  const lut = buildNearestLut(allowed);
  const cells = new Uint8Array(cellsW * cellsH);
  const lineCells = new Uint8Array(cellsW * cellsH);
  const { width: w, data } = work;
  const area = cellPx * cellPx;
  const votes = new Uint16Array(33);

  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let bgCount = 0;
      let lineCount = 0;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const i = y * w + x;
          if (bg[i]) bgCount++;
          else if (lines && lines[i]) lineCount++;
        }
      }
      const ci = cy * cellsW + cx;
      if (bgCount * 2 > area) continue;
      const useLines = lines !== null && lineCount >= lineThreshold * area && lineCount > 0;
      if (useLines) lineCells[ci] = 1;

      votes.fill(0);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const i = y * w + x;
          if (bg[i]) continue;
          if (useLines && !lines![i]) continue;
          const p = i * 4;
          votes[nearestIndex(lut, data[p], data[p + 1], data[p + 2])]++;
          r += data[p];
          g += data[p + 1];
          b += data[p + 2];
          n++;
        }
      }
      if (n === 0) continue;
      let best = 0;
      let bestVotes = 0;
      const mean = srgbToOklab(r / n, g / n, b / n);
      for (let k = 1; k <= 32; k++) {
        if (votes[k] === 0) continue;
        if (
          votes[k] > bestVotes ||
          (votes[k] === bestVotes && oklabDist2(mean, srgbToOklab(...beadByIndex(k).rgb)) < oklabDist2(mean, srgbToOklab(...beadByIndex(best).rgb)))
        ) {
          best = k;
          bestVotes = votes[k];
        }
      }
      cells[ci] = best;
    }
  }
  return { cells, lineCells };
}
