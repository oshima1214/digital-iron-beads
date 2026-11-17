import { ALL64 } from '../palette/perler';
import { countBeads } from '../sheet/counts';
import { imageToOklab } from '../color/oklab';
import { createSheet, type Sheet } from '../sheet/sheet';
import { backgroundMask } from './background';
import { assignCells } from './cells';
import { denoise } from './denoise';
import { ditherCells } from './dither';
import { lineMask } from './lines';
import { fitToWork } from './resample';
import { twoColorCells } from './twoColor';
import { type ConvertSettings, type RgbaImage, WORK_CELL_PX } from './types';

/** 画像 → ビーズシート（仕様書 §5.1 案1）。シートは size×size、変換結果は左上寄せ、残りは背景。 */
export function convertImage(img: RgbaImage, s: ConvertSettings, cellPx = WORK_CELL_PX): Sheet {
  const { work, cellsW, cellsH } = fitToWork(img, s.size, cellPx);
  const lab = imageToOklab(work.data, work.width * work.height);
  const bg = backgroundMask(work, s.removeBackground, s.backgroundTolerance, lab);

  let cells: Uint8Array;
  let protect: Uint8Array | null = null;
  if (s.preset === 'twoColor') {
    const tc = s.twoColor;
    if (!tc) throw new Error('twoColor settings are required for the twoColor preset');
    cells = twoColorCells(work, cellsW, cellsH, cellPx, bg, tc.dark, tc.light, tc.threshold);
  } else if (s.preset === 'photo' && s.dither) {
    cells = ditherCells(work, cellsW, cellsH, cellPx, bg, s.allowedBeads);
  } else {
    const lines = s.preset === 'illust' ? lineMask(work, bg, lab, cellPx) : null;
    const r = assignCells(work, cellsW, cellsH, cellPx, bg, lines, s.allowedBeads, s.lineThreshold);
    cells = r.cells;
    if (lines) protect = r.lineCells;
  }

  denoise(cells, cellsW, cellsH, s.noise, protect);

  const sheet = createSheet(s.size, s.size);
  for (let y = 0; y < cellsH; y++) sheet.cells.set(cells.subarray(y * cellsW, (y + 1) * cellsW), y * s.size);
  return sheet;
}

/**
 * 「元の色」：ビーズの色に変える前の、マスごとの平均の色（背景のマスは透明）。
 * 戻り値は size×size の画像（1ピクセル = 1マス、左上寄せ）。背景の判定は convertImage と同じ。
 */
export function originalCells(img: RgbaImage, s: ConvertSettings, cellPx = WORK_CELL_PX): RgbaImage {
  const { work, cellsW, cellsH } = fitToWork(img, s.size, cellPx);
  const bg = backgroundMask(work, s.removeBackground, s.backgroundTolerance);
  const out = new Uint8ClampedArray(s.size * s.size * 4);
  const W = work.width;
  const d = work.data;
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      let bgCount = 0;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const i = y * W + x;
          if (bg[i]) {
            bgCount++;
            continue;
          }
          r += d[i * 4];
          g += d[i * 4 + 1];
          b += d[i * 4 + 2];
          n++;
        }
      }
      // 半分より多くが背景のマスは背景（ビーズにするときと同じ）
      if (n === 0 || bgCount * 2 > cellPx * cellPx) continue;
      const o = (cy * s.size + cx) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return { width: s.size, height: s.size, data: out };
}

/** 64色すべてで変換したときに使われる色（多い順）。手持ちを選ぶ画面の「この画像に合う色」。 */
export function recommendBeads(img: RgbaImage, s: ConvertSettings, cellPx = 2): number[] {
  const all = convertImage(img, { ...s, preset: s.preset === 'twoColor' ? 'illust' : s.preset, dither: false, beadSet: 'owned', allowedBeads: [...ALL64] }, cellPx);
  return countBeads(all).map((c) => c.index);
}
