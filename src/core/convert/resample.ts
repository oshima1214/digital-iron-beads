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
  const out = new Uint8ClampedArray(W * H * 4);
  const fx = img.width / W;
  const fy = img.height / H;
  const src = img.data;
  for (let y = 0; y < H; y++) {
    const y0 = y * fy;
    const y1 = (y + 1) * fy;
    for (let x = 0; x < W; x++) {
      const x0 = x * fx;
      const x1 = (x + 1) * fx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let wsum = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const si = (sy * img.width + sx) * 4;
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
