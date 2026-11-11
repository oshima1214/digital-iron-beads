import { type Oklab, oklabDist2, srgbToOklab } from '../color/oklab';
import { beadByIndex } from '../palette/perler32';

const lab = (i: number): Oklab => srgbToOklab(...beadByIndex(i).rgb);

/** 使用色数が maxColors 以下になるまで、最も少ない色を OKLab で最も近い残りの色へまとめる（その場で書き換え）。 */
export function reduceColors(cells: Uint8Array, maxColors: number): void {
  const counts = new Map<number, number>();
  for (const v of cells) if (v !== 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  const remap = new Map<number, number>();
  const target = Math.max(1, maxColors);
  while (counts.size > target) {
    let least = -1;
    let leastN = Infinity;
    for (const [k, n] of counts) {
      if (n < leastN || (n === leastN && k > least)) {
        least = k;
        leastN = n;
      }
    }
    counts.delete(least);
    let best = -1;
    let bestD = Infinity;
    for (const k of counts.keys()) {
      const d = oklabDist2(lab(least), lab(k));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    counts.set(best, (counts.get(best) ?? 0) + leastN);
    remap.set(least, best);
    for (const [from, to] of remap) if (to === least) remap.set(from, best);
  }
  if (remap.size === 0) return;
  for (let i = 0; i < cells.length; i++) {
    const to = remap.get(cells[i]);
    if (to !== undefined) cells[i] = to;
  }
}
