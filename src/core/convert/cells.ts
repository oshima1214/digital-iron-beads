import { type Oklab, oklabDist2, srgbToOklab } from '../color/oklab';
import { buildNearestLut, nearestIndex, type NearestLut } from '../palette/nearest';
import { beadByIndex } from '../palette/perler32';
import type { RgbaImage } from './types';

/** 途切れ補修: 線ピクセルがこの割合（lineThreshold に対する比）以上あるマスを補修の候補にする。 */
export const BRIDGE_RATIO = 0.25;

const beadLab = (k: number): Oklab => srgbToOklab(...beadByIndex(k).rgb);

/** ピクセル列の最近傍ビーズの最頻値。同数は平均色に近い方。 */
function modeBead(data: Uint8ClampedArray, pixels: readonly number[], lut: NearestLut, votes: Uint16Array): number {
  votes.fill(0);
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of pixels) {
    const p = i * 4;
    votes[nearestIndex(lut, data[p], data[p + 1], data[p + 2])]++;
    r += data[p];
    g += data[p + 1];
    b += data[p + 2];
  }
  const n = pixels.length;
  const mean = srgbToOklab(r / n, g / n, b / n);
  let best = 0;
  let bestVotes = 0;
  for (let k = 1; k <= 32; k++) {
    if (votes[k] === 0) continue;
    if (votes[k] > bestVotes || (votes[k] === bestVotes && oklabDist2(mean, beadLab(k)) < oklabDist2(mean, beadLab(best)))) {
      best = k;
      bestVotes = votes[k];
    }
  }
  return best;
}

/** 線ピクセルのうち暗い方の半分（混ざっていない線本来の色）の最頻値。 */
function darkLineBead(data: Uint8ClampedArray, linePixels: number[], lut: NearestLut, votes: Uint16Array): number {
  const L = (i: number) => srgbToOklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])[0];
  const sorted = linePixels.map((i) => [L(i), i] as const).sort((a, b) => a[0] - b[0]);
  const dark = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2))).map(([, i]) => i);
  return modeBead(data, dark, lut, votes);
}

/**
 * マスごとの代表色。
 * 1. lines があり、線ピクセルが lineThreshold 以上なら、線ピクセルの暗い半分で色を決め lineCells=1（背景が過半でも）
 * 2. それ以外で背景ピクセルが 50% を超えるマスは 0
 * 3. それ以外は背景以外のピクセルを最近傍ビーズに置き換えた最頻値
 * 4. 途切れ補修: 線マスでないが線ピクセルを少し含むマスが、縦・横・斜めの向かい合う2方向とも線マスなら、
 *    隣の線マスの色の線マスにする
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
  const n = cellsW * cellsH;
  const cells = new Uint8Array(n);
  const lineCells = new Uint8Array(n);
  const lineColor = new Uint8Array(n);
  const lineFrac = new Float32Array(n);
  const { width: w, data } = work;
  const area = cellPx * cellPx;
  const votes = new Uint16Array(33);

  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      const ci = cy * cellsW + cx;
      let bgCount = 0;
      const fg: number[] = [];
      const lp: number[] = [];
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const i = y * w + x;
          if (bg[i]) bgCount++;
          else {
            fg.push(i);
            if (lines && lines[i]) lp.push(i);
          }
        }
      }
      if (fg.length === 0) continue;
      const isLineCell = lines !== null && lp.length > 0 && lp.length >= lineThreshold * area;
      // 背景が過半のマスは背景。ただし線が十分に通っていれば線マスとして残す（白地の細い線など）。
      if (bgCount * 2 > area && !isLineCell) continue;
      lineFrac[ci] = lp.length / area;
      if (lp.length > 0) lineColor[ci] = darkLineBead(data, lp, lut, votes);
      if (isLineCell) {
        lineCells[ci] = 1;
        cells[ci] = lineColor[ci];
      } else {
        cells[ci] = modeBead(data, fg, lut, votes);
      }
    }
  }

  if (lines) {
    const isLine = (x: number, y: number) => x >= 0 && y >= 0 && x < cellsW && y < cellsH && lineCells[y * cellsW + x] === 1;
    const pairs = [
      [-1, 0, 1, 0],
      [0, -1, 0, 1],
      [-1, -1, 1, 1],
      [1, -1, -1, 1],
    ];
    const bridged: [number, number][] = [];
    for (let cy = 0; cy < cellsH; cy++) {
      for (let cx = 0; cx < cellsW; cx++) {
        const ci = cy * cellsW + cx;
        if (lineCells[ci] || cells[ci] === 0 || lineFrac[ci] < lineThreshold * BRIDGE_RATIO) continue;
        const hit = pairs.find(([ax, ay, bx, by]) => isLine(cx + ax, cy + ay) && isLine(cx + bx, cy + by));
        if (hit) bridged.push([ci, cells[(cy + hit[1]) * cellsW + cx + hit[0]]]);
      }
    }
    for (const [ci, color] of bridged) {
      lineCells[ci] = 1;
      cells[ci] = color;
    }
  }
  return { cells, lineCells };
}
