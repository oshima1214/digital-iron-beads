/**
 * V7（legacy/DigitalIronBeadsV7_colab.py）の変換を再現する比較用実装。
 * process_uploaded_image → create_bead_sheet / create_extra_large_bead_sheet の流れ。
 */
import type { RgbaImage } from '../../src/core/convert/types';
import { resizeArea } from '../../src/core/image/adjust';

export { resizeArea };
import { BASIC16, ALL32, beadByIndex } from '../../src/core/palette/perler32';
import { createSheet, type Sheet, type SheetSize } from '../../src/core/sheet/sheet';

const CANVAS = 930;

/** 長辺 930 にリサイズして 930×930 の黒キャンバスの左上に置く（アルファは捨てる＝V7 の RGB 変換相当）。 */
function toCanvas(img: RgbaImage): RgbaImage {
  const s = CANVAS / Math.max(img.width, img.height);
  const r = resizeArea(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
  const data = new Uint8ClampedArray(CANVAS * CANVAS * 4);
  for (let i = 0; i < CANVAS * CANVAS; i++) data[i * 4 + 3] = 255;
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const si = (y * r.width + x) * 4;
      const di = (y * CANVAS + x) * 4;
      data[di] = r.data[si];
      data[di + 1] = r.data[si + 1];
      data[di + 2] = r.data[si + 2];
    }
  }
  return { width: CANVAS, height: CANVAS, data };
}

function crop(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let yy = 0; yy < h; yy++) data.set(img.data.subarray(((y + yy) * img.width + x) * 4, ((y + yy) * img.width + x + w) * 4), yy * w * 4);
  return { width: w, height: h, data };
}

/** グレー値 > 10 の bounding rect で切り出す（なければ全体）。 */
function trimDark(img: RgbaImage): RgbaImage {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const gray = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      if (gray > 10) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return x1 < 0 ? img : crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function nearestRgb(r: number, g: number, b: number, palette: readonly number[]): number {
  let best = palette[0];
  let bestD = Infinity;
  for (const i of palette) {
    const [pr, pg, pb] = beadByIndex(i).rgb;
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function legacyConvert(img: RgbaImage, size: SheetSize, mode: 16 | 32): Sheet {
  let region = trimDark(toCanvas(img));
  let cell: number;
  if (size <= 29) {
    const scale = size / 29;
    if (scale < 1) {
      region = resizeArea(region, Math.max(1, Math.floor(region.width * scale)), Math.max(1, Math.floor(region.height * scale)));
    }
    cell = 30;
  } else {
    // V7 の特大(58)は 15px マス。116 は V7 に無いため 930/116 ≒ 8px で外挿。
    cell = size === 58 ? 15 : 8;
  }
  const cellsW = Math.min(size, Math.floor(region.width / cell));
  const cellsH = Math.min(size, Math.floor(region.height / cell));
  const palette = mode === 16 ? BASIC16 : ALL32;
  const sheet = createSheet(size, size);
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = cy * cell; y < (cy + 1) * cell; y++) {
        for (let x = cx * cell; x < (cx + 1) * cell; x++) {
          const i = (y * region.width + x) * 4;
          r += region.data[i];
          g += region.data[i + 1];
          b += region.data[i + 2];
        }
      }
      const n = cell * cell;
      sheet.cells[cy * size + cx] = nearestRgb(Math.trunc(r / n), Math.trunc(g / n), Math.trunc(b / n), palette);
    }
  }
  return sheet;
}
