import type { RgbaImage } from './types';

export type Rgba = [number, number, number, number];

export function solid(w: number, h: number, c: Rgba): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(c, i * 4);
  return { width: w, height: h, data };
}

export function drawRect(img: RgbaImage, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < img.width && yy < img.height) img.data.set(c, (yy * img.width + xx) * 4);
    }
  }
}

/** シード固定の疑似乱数ノイズ画像（不透明）。 */
export function noiseImage(w: number, h: number, seed = 1): RgbaImage {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 24);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([rnd(), rnd(), rnd(), 255], i * 4);
  return { width: w, height: h, data };
}
