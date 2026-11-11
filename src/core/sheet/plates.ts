import { getCell, PLATE, type Sheet, type SheetSize } from './sheet';

export interface Plate {
  index: number;
  col: number;
  row: number;
  /** シート座標で見たプレートの左上 */
  originX: number;
  originY: number;
}

export function plateGrid(size: SheetSize): { cols: number; rows: number } {
  const n = Math.max(1, Math.ceil(size / PLATE));
  return { cols: n, rows: n };
}

export function platesOf(sheet: Sheet): Plate[] {
  const cols = Math.max(1, Math.ceil(sheet.width / PLATE));
  const rows = Math.max(1, Math.ceil(sheet.height / PLATE));
  const plates: Plate[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      plates.push({ index: plates.length, col, row, originX: col * PLATE, originY: row * PLATE });
    }
  }
  return plates;
}

/** px, py は 0..28。シートの外は 0。 */
export function plateCell(sheet: Sheet, plate: Plate, px: number, py: number): number {
  return getCell(sheet, plate.originX + px, plate.originY + py);
}
