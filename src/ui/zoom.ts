export interface Pt {
  x: number;
  y: number;
}

/** 表示座標 = 内容座標 × scale + (tx, ty) */
export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function toContent(t: Transform, p: Pt): Pt {
  return { x: (p.x - t.tx) / t.scale, y: (p.y - t.ty) / t.scale };
}

/** 2本指の開始位置 (a0,b0) と現在位置 (a1,b1) から、開始時の中点の内容が今の中点に来るよう拡大・移動する。 */
export function pinch(start: Transform, a0: Pt, b0: Pt, a1: Pt, b1: Pt): Transform {
  const d0 = dist(a0, b0);
  const scale = d0 > 0 ? (start.scale * dist(a1, b1)) / d0 : start.scale;
  const c = toContent(start, mid(a0, b0));
  const m = mid(a1, b1);
  return { scale, tx: m.x - c.x * scale, ty: m.y - c.y * scale };
}

/** scale を 1..8 に収め、拡大した内容が箱より大きい軸は余白が出ないように、小さい軸は中央に寄せる。 */
export function clampTransform(t: Transform, contentW: number, contentH: number, boxW: number, boxH: number): Transform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale));
  const axis = (v: number, content: number, box: number) => {
    const size = content * scale;
    if (size <= box) return (box - size) / 2;
    return Math.min(0, Math.max(box - size, v));
  };
  return { scale, tx: axis(t.tx, contentW, boxW), ty: axis(t.ty, contentH, boxH) };
}
