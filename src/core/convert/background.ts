import { type Oklab, oklabDist2, srgbToOklab } from '../color/oklab';
import type { RgbaImage } from './types';

/** 外周ピクセルで最も多い色（RGB 各4ビットのビン）の平均を OKLab で返す。 */
function dominantBorderColor(img: RgbaImage, lab: Oklab[]): Oklab | null {
  const { width: w, height: h, data } = img;
  const bins = new Map<number, number[]>();
  const add = (i: number) => {
    if (data[i * 4 + 3] < 128) return;
    const key = ((data[i * 4] >> 4) << 8) | ((data[i * 4 + 1] >> 4) << 4) | (data[i * 4 + 2] >> 4);
    const list = bins.get(key);
    if (list) list.push(i);
    else bins.set(key, [i]);
  };
  for (let x = 0; x < w; x++) {
    add(x);
    if (h > 1) add((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    add(y * w);
    if (w > 1) add(y * w + w - 1);
  }
  let best: number[] | null = null;
  for (const list of bins.values()) if (!best || list.length > best.length) best = list;
  if (!best) return null;
  let L = 0;
  let A = 0;
  let B = 0;
  for (const i of best) {
    L += lab[i][0];
    A += lab[i][1];
    B += lab[i][2];
  }
  return [L / best.length, A / best.length, B / best.length];
}

/**
 * 背景マスク（1 = 背景）。
 * - アルファ 128 未満は常に背景。
 * - removeBackground のとき、外周で最も多い色を背景色とし、それに近い（ΔE ≤ 2*tol）外周ピクセルを起点に
 *   4近傍で広げる。隣との ΔE ≤ tol かつ背景色との ΔE ≤ 2*tol なら背景。
 *   画像の端に接したオブジェクトは、背景色と違えば消えない。
 */
export function backgroundMask(img: RgbaImage, removeBackground: boolean, tolerance: number): Uint8Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 128) mask[i] = 1;
  if (!removeBackground) return mask;

  const lab: Oklab[] = new Array(n);
  for (let i = 0; i < n; i++) lab[i] = srgbToOklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const ref = dominantBorderColor(img, lab);
  if (!ref) return mask;
  const tol2 = tolerance * tolerance;
  const refTol2 = 4 * tol2;
  const visited = new Uint8Array(n);
  const stack: number[] = [];

  const seed = (i: number) => {
    if (visited[i] || data[i * 4 + 3] < 128 || oklabDist2(ref, lab[i]) > refTol2) return;
    visited[i] = 1;
    mask[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    const visit = (ni: number) => {
      if (visited[ni] || data[ni * 4 + 3] < 128) return;
      if (oklabDist2(lab[i], lab[ni]) > tol2 || oklabDist2(ref, lab[ni]) > refTol2) return;
      visited[ni] = 1;
      mask[ni] = 1;
      stack.push(ni);
    };
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (y > 0) visit(i - w);
    if (y < h - 1) visit(i + w);
  }
  return mask;
}
