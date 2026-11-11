import type { Sheet } from '@/core/sheet/sheet';

/** 4px 以上のマスは整数ピクセルに切り捨て（線がにじまないように）、それ未満は箱を埋める小数のまま。 */
export const MIN_INTEGER_CELL = 4;

export function sheetLayout(sheet: Sheet, boxW: number, boxH: number): { cell: number; width: number; height: number } {
  const raw = Math.max(0, Math.min(boxW / sheet.width, boxH / sheet.height));
  const cell = raw >= MIN_INTEGER_CELL ? Math.floor(raw) : raw;
  return { cell, width: cell * sheet.width, height: cell * sheet.height };
}
