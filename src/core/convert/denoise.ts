/**
 * 上下左右に同じ値がない孤立マスを、周り8マスの多数派（背景 0 を含む）に置き換える。
 * strength 回くり返す。protect=1 のマスは対象外。
 */
export function denoise(cells: Uint8Array, w: number, h: number, strength: 0 | 1 | 2, protect: Uint8Array | null): void {
  const votes = new Uint8Array(33);
  for (let pass = 0; pass < strength; pass++) {
    const src = cells.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (protect && protect[i]) continue;
        const v = src[i];
        const same =
          (x > 0 && src[i - 1] === v) ||
          (x < w - 1 && src[i + 1] === v) ||
          (y > 0 && src[i - w] === v) ||
          (y < h - 1 && src[i + w] === v);
        if (same) continue;
        votes.fill(0);
        let any = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            votes[src[ny * w + nx]]++;
            any = true;
          }
        }
        if (!any) continue;
        let best = v;
        let bestN = 0;
        for (let k = 0; k <= 32; k++) {
          if (votes[k] > bestN) {
            best = k;
            bestN = votes[k];
          }
        }
        cells[i] = best;
      }
    }
  }
}
