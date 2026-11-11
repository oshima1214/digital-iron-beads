import { imageToOklab } from '../color/oklab';
import type { RgbaImage } from './types';

export const LINE_CONTRAST = 0.12;

/**
 * 輪郭線マスク（1 = 線）。L < 周囲 (2*radius+1)² の平均 L - LINE_CONTRAST。
 * 明るさの絶対値は見ない（色のついた細い線や、縮小で白と混ざった線も拾う）。
 * 背景ピクセル自体は線にしない。平均には不透明な背景（外周推定で消した白地など）を含め、透明ピクセルは含めない。
 * radius はマスの大きさ（cellPx）を渡す。
 */
export function lineMask(img: RgbaImage, bg: Uint8Array, labCache?: Float32Array, radius = 2): Uint8Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const lab = labCache ?? imageToOklab(data, n);
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = lab[i * 3];

  // 背景を除いた L と個数の積分画像で 5x5 平均を求める
  const W1 = w + 1;
  const sum = new Float64Array(W1 * (h + 1));
  const cnt = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0;
    let rc = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bg[i] || data[i * 4 + 3] >= 128) {
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
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const c = box(cnt, x0, y0, x1, y1);
      const mean = c > 0 ? box(sum, x0, y0, x1, y1) / c : L[i];
      if (L[i] < mean - LINE_CONTRAST) out[i] = 1;
    }
  }
  return out;
}
