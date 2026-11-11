import { idx, inBounds, type Sheet } from './sheet';

export interface CellChange {
  i: number;
  before: number;
  after: number;
}

export type Cell = [number, number];

export function applyChanges(sheet: Sheet, changes: readonly CellChange[], dir: 'forward' | 'backward'): void {
  if (dir === 'forward') {
    for (const c of changes) sheet.cells[c.i] = c.after;
  } else {
    for (let k = changes.length - 1; k >= 0; k--) sheet.cells[changes[k].i] = changes[k].before;
  }
}

/** ペン・消しゴム・選択範囲の色変更／削除で共用。値が変わらないマス・範囲外・重複は除く。 */
export function paintCells(sheet: Sheet, cells: readonly Cell[], value: number): CellChange[] {
  const seen = new Set<number>();
  const out: CellChange[] = [];
  for (const [x, y] of cells) {
    if (!inBounds(sheet, x, y)) continue;
    const i = idx(sheet, x, y);
    if (seen.has(i)) continue;
    seen.add(i);
    const before = sheet.cells[i];
    if (before !== value) out.push({ i, before, after: value });
  }
  return out;
}

export function rectCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) {
    for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, y]);
  }
  return out;
}

/** Bresenham。なぞり操作のマス補間用。 */
export function lineCells(a: Cell, b: Cell): Cell[] {
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: Cell[] = [];
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

const N4: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 上下左右につながった同じ値の範囲を value にする差分。 */
export function floodFill(sheet: Sheet, x: number, y: number, value: number): CellChange[] {
  if (!inBounds(sheet, x, y)) return [];
  const target = sheet.cells[idx(sheet, x, y)];
  if (target === value) return [];
  const seen = new Uint8Array(sheet.cells.length);
  const stack: Cell[] = [[x, y]];
  const out: CellChange[] = [];
  seen[idx(sheet, x, y)] = 1;
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    out.push({ i: idx(sheet, cx, cy), before: target, after: value });
    for (const [dx, dy] of N4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(sheet, nx, ny)) continue;
      const ni = idx(sheet, nx, ny);
      if (seen[ni] || sheet.cells[ni] !== target) continue;
      seen[ni] = 1;
      stack.push([nx, ny]);
    }
  }
  return out;
}

/** 外周とつながった背景マスのマスク（1 = 外部の背景）。filled は「背景以外とみなす」追加マスク。 */
function exteriorBackground(sheet: Sheet, filled: Uint8Array): Uint8Array {
  const { width: w, height: h } = sheet;
  const ext = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (ext[i] || sheet.cells[i] !== 0 || filled[i]) return;
    ext[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) push(nx, ny);
    }
  }
  return ext;
}

/** 外周とつながった背景のうち、背景以外に4近傍で接するマスを value で塗る（thickness 回）。内部の穴は塗らない。 */
export function outline(sheet: Sheet, value: number, thickness: 1 | 2): CellChange[] {
  const { width: w, height: h } = sheet;
  const filled = new Uint8Array(w * h);
  const ext = exteriorBackground(sheet, filled);
  const out: CellChange[] = [];
  for (let pass = 0; pass < thickness; pass++) {
    const ring: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (!ext[i] || filled[i]) continue;
      const x = i % w;
      const y = (i - x) / w;
      const touches = N4.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
        const ni = ny * w + nx;
        return sheet.cells[ni] !== 0 || filled[ni] === 1;
      });
      if (touches) ring.push(i);
    }
    for (const i of ring) {
      filled[i] = 1;
      out.push({ i, before: 0, after: value });
    }
  }
  return out;
}
