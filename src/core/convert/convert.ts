import { imageToOklab } from '../color/oklab';
import { createSheet, type Sheet } from '../sheet/sheet';
import { backgroundMask } from './background';
import { assignCells } from './cells';
import { denoise } from './denoise';
import { ditherCells } from './dither';
import { lineMask } from './lines';
import { reduceColors } from './reduce';
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
    const lines = s.preset === 'illust' ? lineMask(work, bg, lab) : null;
    const r = assignCells(work, cellsW, cellsH, cellPx, bg, lines, s.allowedBeads, s.lineThreshold);
    cells = r.cells;
    if (lines) protect = r.lineCells;
  }

  if (s.preset !== 'twoColor') reduceColors(cells, s.maxColors);
  denoise(cells, cellsW, cellsH, s.noise, protect);

  const sheet = createSheet(s.size, s.size);
  for (let y = 0; y < cellsH; y++) sheet.cells.set(cells.subarray(y * cellsW, (y + 1) * cellsW), y * s.size);
  return sheet;
}
