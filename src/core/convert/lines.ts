import { srgbToOklab } from '../color/oklab';
import type { RgbaImage } from './types';

export const LINE_CONTRAST = 0.12;
export const LINE_MAX_L = 0.5;

/**
 * 輪郭線マスク（1 = 線）。L < mean5x5(L) - 0.12 かつ L < 0.5。
 * 背景ピクセルは対象外で、平均の計算にも含めない。
 */
export function lineMask(img: RgbaImage, bg: Uint8Array): Uint8Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = srgbToOklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])[0];

  // 背景を除いた L と個数の積分画像で 5x5 平均を求める
  const W1 = w + 1;
  const sum = new Float64Array(W1 * (h + 1));
  const cnt = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0;
    let rc = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bg[i]) {
        rs += L[i];
        rc += 1;
      }
      sum[(y + 1) * W1 + x + 1] = sum[y * W1 + x + 1] + rs;
      cnt[(y + 1) * W1 + x + 1] = cnt[y * W1 + x + 1] + rc;
    }
  }
  const box = (a: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    a[y1 * W1 + x1] - a[y0 * W1 + x1] - a[y1 * W1 + x0] + a[y0 * W1 + x0];

  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.min(h, y + 3);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bg[i] || L[i] >= LINE_MAX_L) continue;
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(w, x + 3);
      const c = box(cnt, x0, y0, x1, y1);
      const mean = c > 0 ? box(sum, x0, y0, x1, y1) / c : L[i];
      if (L[i] < mean - LINE_CONTRAST) out[i] = 1;
    }
  }
  return out;
}
