import type { Sheet } from '@/core/sheet/sheet';

/** 4px 以上のマスは整数ピクセルに切り捨て（線がにじまないように）、それ未満は箱を埋める小数のまま。 */
export const MIN_INTEGER_CELL = 4;

export function sheetLayout(sheet: Sheet, boxW: number, boxH: number): { cell: number; width: number; height: number } {
  const raw = Math.max(0, Math.min(boxW / sheet.width, boxH / sheet.height));
  const cell = raw >= MIN_INTEGER_CELL ? Math.floor(raw) : raw;
  return { cell, width: cell * sheet.width, height: cell * sheet.height };
}

/** シート描画領域の左上を原点とした座標 → マス [x, y]。範囲外・マスが 0 のときは null。反転中は x を戻す。 */
export function viewToCell(px: number, py: number, sheet: Sheet, cell: number, mirror: boolean): [number, number] | null {
  if (cell <= 0) return null;
  const vx = Math.floor(px / cell);
  const y = Math.floor(py / cell);
  if (px < 0 || py < 0 || vx >= sheet.width || y >= sheet.height) return null;
  return [mirror ? sheet.width - 1 - vx : vx, y];
}
