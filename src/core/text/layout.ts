import { createSheet, type Sheet, type SheetSize } from '../sheet/sheet';

/** 29 マスで1文字の高さ（V7 と同じ）。ほかのサイズは比率で決める。 */
const BASE_CHAR_H = 14;
const BASE_SIZE = 29;

export function isHalfWidth(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xff61 && c <= 0xff9f);
}

export interface TextLayout {
  charH: number;
  widths: number[];
  totalW: number;
  /** シートの幅に収まり、1文字以上ある */
  fits: boolean;
  /** 全角で入る最大の文字数 */
  maxFull: number;
}

export function textLayout(text: string, size: SheetSize): TextLayout {
  const charH = Math.round((size * BASE_CHAR_H) / BASE_SIZE);
  const half = Math.round(charH / 2);
  const widths = [...text].map((ch) => (isHalfWidth(ch) ? half : charH));
  const totalW = widths.reduce((a, b) => a + b, 0);
  return { charH, widths, totalW, fits: widths.length > 0 && totalW <= size, maxFull: Math.floor(size / charH) };
}

/** 文字の形（不透明度 0..255、行優先）をマスにする。マスの中で threshold 以上が文字なら textBead、それ以外は bgBead。 */
export function maskToCells(mask: Uint8Array, maskW: number, maskH: number, cellPx: number, textBead: number, bgBead: number, threshold = 0.5): Uint8Array {
  const w = Math.floor(maskW / cellPx);
  const h = Math.floor(maskH / cellPx);
  const out = new Uint8Array(w * h);
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      let sum = 0;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) sum += mask[y * maskW + x];
      out[cy * w + cx] = sum / (255 * cellPx * cellPx) >= threshold ? textBead : bgBead;
    }
  }
  return out;
}

/** w×h のマスを size×size のシートの中央に置く。 */
export function placeText(cells: Uint8Array, w: number, h: number, size: SheetSize): Sheet {
  const s = createSheet(size, size);
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ox + x < size && oy + y < size) s.cells[(oy + y) * size + ox + x] = cells[y * w + x];
  return s;
}
