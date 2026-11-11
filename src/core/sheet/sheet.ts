import type { PaletteId } from '../palette/types';

export type SheetSize = 13 | 21 | 29 | 58 | 116;
export const PLATE = 29;

export interface Sheet {
  width: number;
  height: number;
  /** 長さ width*height（行優先）。0 = 背景、1..32 = Bead.index */
  cells: Uint8Array;
  paletteId: PaletteId;
}

export function createSheet(width: number, height: number): Sheet {
  return { width, height, cells: new Uint8Array(width * height), paletteId: 'perler-32' };
}

export function idx(sheet: Sheet, x: number, y: number): number {
  return y * sheet.width + x;
}

export function inBounds(sheet: Sheet, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < sheet.width && y < sheet.height;
}

export function getCell(sheet: Sheet, x: number, y: number): number {
  return inBounds(sheet, x, y) ? sheet.cells[idx(sheet, x, y)] : 0;
}

export function cloneSheet(s: Sheet): Sheet {
  return { ...s, cells: s.cells.slice() };
}
