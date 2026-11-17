import { PALETTE } from '@/core/palette/perler';

/**
 * 使うビーズの画面の色の並び（番号順＝今までと同じ。基本16色 → 追加16色 → 手持ち用32色）。
 * 位置を計算で決めるので、なぞったときの当たり判定が正確。
 */
export interface BeadGrid {
  chipW: number;
  chipH: number;
  gap: number;
  cells: { index: number; x: number; y: number }[];
  height: number;
}

export function beadGridLayout(width: number, chipW = 72, chipH = 66, gap = 6): BeadGrid {
  const cols = Math.max(1, Math.floor((width + gap) / (chipW + gap)));
  const rowW = cols * chipW + (cols - 1) * gap;
  const left = Math.max(0, (width - rowW) / 2); // 真ん中にそろえる
  const cells = PALETTE.map((b, i) => ({ index: b.index, x: left + (i % cols) * (chipW + gap), y: Math.floor(i / cols) * (chipH + gap) }));
  const rows = Math.ceil(PALETTE.length / cols);
  return { chipW, chipH, gap, cells, height: rows * chipH + (rows - 1) * gap };
}

/** 点 (x, y) の下のビーズの番号。すき間・外なら null。 */
export function beadAt(g: BeadGrid, x: number, y: number): number | null {
  for (const c of g.cells) if (x >= c.x && x < c.x + g.chipW && y >= c.y && y < c.y + g.chipH) return c.index;
  return null;
}
