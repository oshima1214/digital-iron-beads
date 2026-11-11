import type { SheetSize } from '../sheet/sheet';
import { type RgbaImage, WORK_CELL_PX } from './types';

/**
 * 縦横比を保って size*cellPx の正方形に収める（左上寄せ）。面積平均で縮小、拡大は最近傍。
 * 出力は cellsW*cellPx × cellsH*cellPx。cellsW, cellsH は 1 以上。
 */
export function fitToWork(
  img: RgbaImage,
  size: SheetSize,
  cellPx = WORK_CELL_PX,
): { work: RgbaImage; cellsW: number; cellsH: number } {
  const scale = Math.min(size / img.width, size / img.height);
  const cellsW = Math.max(1, Math.min(size, Math.round(img.width * scale)));
  const cellsH = Math.max(1, Math.min(size, Math.round(img.height * scale)));
  const W = cellsW * cellPx;
  const H = cellsH * cellPx;
  const xs = spans(img.width, W);
  const ys = spans(img.height, H);
  const out = new Uint8ClampedArray(W * H * 4);
  const src = img.data;
  const sw = img.width;
  for (let y = 0; y < H; y++) {
    const ry = ys[y];
    for (let x = 0; x < W; x++) {
      const rx = xs[x];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let wsum = 0;
      for (let ky = 0; ky < ry.idx.length; ky++) {
        const wy = ry.w[ky];
        const row = ry.idx[ky] * sw;
        for (let kx = 0; kx < rx.idx.length; kx++) {
          const w = rx.w[kx] * wy;
          const si = (row + rx.idx[kx]) * 4;
          r += src[si] * w;
          g += src[si + 1] * w;
          b += src[si + 2] * w;
          a += src[si + 3] * w;
          wsum += w;
        }
      }
      const oi = (y * W + x) * 4;
      out[oi] = r / wsum;
      out[oi + 1] = g / wsum;
      out[oi + 2] = b / wsum;
      out[oi + 3] = a / wsum;
    }
  }
  return { work: { width: W, height: H, data: out }, cellsW, cellsH };
}

interface Span {
  idx: number[];
  w: number[];
}

/** 出力 n 画素それぞれが覆う入力 [0, len) の区間（面積平均の重み）。 */
function spans(len: number, n: number): Span[] {
  const f = len / n;
  const out: Span[] = [];
  for (let o = 0; o < n; o++) {
    const a = o * f;
    const b = (o + 1) * f;
    const s: Span = { idx: [], w: [] };
    for (let k = Math.floor(a); k < Math.ceil(b); k++) {
      const w = Math.min(b, k + 1) - Math.max(a, k);
      if (w > 0) {
        s.idx.push(Math.min(len - 1, k));
        s.w.push(w);
      }
    }
    out.push(s);
  }
  return out;
}
