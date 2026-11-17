import { FAMILIES, PALETTE } from '@/core/palette/perler';
import type { BeadFamily } from '@/core/palette/types';

/** 手持ちを選ぶ画面のビーズの並び（系統ごとに行を分ける）。位置を計算で決めるので、なぞったときの当たり判定が正確。 */
export interface BeadGrid {
  size: number;
  gap: number;
  /** 系統の名前の列の幅 */
  labelW: number;
  cells: { index: number; x: number; y: number }[];
  rows: { family: BeadFamily; label: string; y: number }[];
  height: number;
}

export function beadGridLayout(width: number, size = 28, gap = 6, labelW = 34): BeadGrid {
  const cols = Math.max(1, Math.floor((width - labelW + gap) / (size + gap)));
  const cells: BeadGrid['cells'] = [];
  const rows: BeadGrid['rows'] = [];
  let y = 0;
  for (const f of FAMILIES) {
    rows.push({ family: f.id, label: f.label, y });
    f.codes.forEach((code, i) => {
      const bead = PALETTE.find((b) => b.code === code)!;
      cells.push({ index: bead.index, x: labelW + (i % cols) * (size + gap), y: y + Math.floor(i / cols) * (size + gap) });
    });
    y += Math.ceil(f.codes.length / cols) * (size + gap);
  }
  return { size, gap, labelW, cells, rows, height: Math.max(0, y - gap) };
}

/** 点 (x, y) の下のビーズの番号。すき間・外なら null。 */
export function beadAt(g: BeadGrid, x: number, y: number): number | null {
  for (const c of g.cells) if (x >= c.x && x < c.x + g.size && y >= c.y && y < c.y + g.size) return c.index;
  return null;
}
