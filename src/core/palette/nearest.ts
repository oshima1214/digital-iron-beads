import { type Oklab, oklabDist2, srgbToOklab } from '../color/oklab';
import { beadByIndex } from './perler32';

/** sRGB を各チャンネル5ビットに量子化したキー → ビーズ番号。長さ 32768。 */
export type NearestLut = Uint8Array;

const cache = new Map<string, NearestLut>();
const beadLabCache = new Map<number, Oklab>();

function beadLab(index: number): Oklab {
  let lab = beadLabCache.get(index);
  if (!lab) {
    lab = srgbToOklab(...beadByIndex(index).rgb);
    beadLabCache.set(index, lab);
  }
  return lab;
}

/**
 * 無彩色ロック: 彩度 (OKLab の a,b の大きさ) がこれ未満の色は、無彩色のビーズ（白・黒・灰色・とうめい）だけから選ぶ。
 * OKLab の距離だけだと、ほぼ黒 (20,20,20) が L の差で焦げ茶に寄ってしまうため。
 */
export const NEUTRAL_CHROMA = 0.03;

const chroma = (c: Oklab) => Math.hypot(c[1], c[2]);

/** 正確な最近傍（対応表なし）。無彩色ロックつき。 */
export function nearestToOklab(allowed: readonly number[], c: Oklab): number {
  if (allowed.length === 0) throw new RangeError('allowed bead set is empty');
  if (chroma(c) < NEUTRAL_CHROMA) {
    const neutral = allowed.filter((i) => chroma(beadLab(i)) < NEUTRAL_CHROMA);
    if (neutral.length > 0) return nearestPlain(neutral, c);
  }
  return nearestPlain(allowed, c);
}

function nearestPlain(allowed: readonly number[], c: Oklab): number {
  let best = allowed[0];
  let bestD = Infinity;
  for (const i of allowed) {
    const d = oklabDist2(c, beadLab(i));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function buildNearestLut(allowed: readonly number[]): NearestLut {
  if (allowed.length === 0) throw new RangeError('allowed bead set is empty');
  const key = [...allowed].sort((a, b) => a - b).join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const lut = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        lut[(r << 10) | (g << 5) | b] = nearestToOklab(allowed, srgbToOklab((r << 3) + 4, (g << 3) + 4, (b << 3) + 4));
      }
    }
  }
  cache.set(key, lut);
  return lut;
}

export function nearestIndex(lut: NearestLut, r: number, g: number, b: number): number {
  return lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}
