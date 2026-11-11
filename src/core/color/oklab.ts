export type Rgb = readonly [number, number, number];
export type Oklab = readonly [number, number, number];

function toLinearExact(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const LINEAR_LUT = new Float64Array(256);
for (let i = 0; i < 256; i++) LINEAR_LUT[i] = toLinearExact(i);

/** 整数 0..255 は表引き、小数（平均色など）は正確に計算する。 */
function toLinear(c: number): number {
  return Number.isInteger(c) && c >= 0 && c <= 255 ? LINEAR_LUT[c] : toLinearExact(c);
}

/** sRGB (0..255) → OKLab (Björn Ottosson). */
export function srgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab のユークリッド距離の2乗。 */
export function oklabDist2(a: Oklab, b: Oklab): number {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}

/** RGBA 画像の各ピクセルを OKLab にした Float32Array（長さ w*h*3）。 */
export function imageToOklab(data: Uint8ClampedArray, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = srgbToOklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    out[i * 3] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}
