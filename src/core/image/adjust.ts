import type { RgbaImage } from '../convert/types';

/** 元画像のピクセル座標での切り抜き範囲。 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 画像との共通部分に切り詰め、最小 minSize×minSize（画像がそれより小さければ画像全体）を保つ。整数に丸める。 */
export function clampCrop(rect: CropRect, imgW: number, imgH: number, minSize = 8): CropRect {
  const axis = (start: number, len: number, max: number): [number, number] => {
    const a = Math.max(0, Math.round(start));
    const b = Math.min(max, Math.round(start + len));
    const size = Math.min(max, Math.max(Math.min(minSize, max), b - a));
    return [Math.max(0, Math.min(a, max - size)), size];
  };
  const [x, w] = axis(rect.x, rect.w, imgW);
  const [y, h] = axis(rect.y, rect.h, imgH);
  return { x, y, w, h };
}

export function cropImage(img: RgbaImage, rect: CropRect): RgbaImage {
  const { x, y, w, h } = rect;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let yy = 0; yy < h; yy++) {
    const start = ((y + yy) * img.width + x) * 4;
    data.set(img.data.subarray(start, start + w * 4), yy * w * 4);
  }
  return { width: w, height: h, data };
}

/** brightness, contrast はどちらも -100..100。アルファは変えない。 */
export function adjustImage(img: RgbaImage, brightness: number, contrast: number): RgbaImage {
  const out = new Uint8ClampedArray(img.data);
  const add = (brightness / 100) * 255;
  const f = (100 + contrast) / 100;
  for (let i = 0; i < out.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = (img.data[i + c] + add - 128) * f + 128;
  }
  return { width: img.width, height: img.height, data: out };
}

/** 面積平均リサイズ。 */
export function resizeArea(img: RgbaImage, W: number, H: number): RgbaImage {
  const out = new Uint8ClampedArray(W * H * 4);
  const fx = img.width / W;
  const fy = img.height / H;
  const acc = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) {
    const y0 = y * fy;
    const y1 = (y + 1) * fy;
    for (let x = 0; x < W; x++) {
      const x0 = x * fx;
      const x1 = (x + 1) * fx;
      acc.fill(0);
      let ws = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const si = (Math.min(img.height - 1, sy) * img.width + Math.min(img.width - 1, sx)) * 4;
          for (let c = 0; c < 4; c++) acc[c] += img.data[si + c] * w;
          ws += w;
        }
      }
      for (let c = 0; c < 4; c++) out[(y * W + x) * 4 + c] = acc[c] / ws;
    }
  }
  return { width: W, height: H, data: out };
}

/** 長い辺が maxSide を超えるときだけ縮小する。 */
export function resizeMax(img: RgbaImage, maxSide: number): RgbaImage {
  const long = Math.max(img.width, img.height);
  if (long <= maxSide) return img;
  const s = maxSide / long;
  return resizeArea(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
}
