import { createSheet, getCell, PLATE, type Sheet, type SheetSize } from './sheet';

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

/** プレート1枚分（29×29、rows を指定すれば [開始, 終了) の行だけ）を切り出した表示用のシート。シートの外は背景。 */
export function plateSheet(sheet: Sheet, plate: Plate, rows: [number, number] = [0, PLATE]): Sheet {
  const [r0, r1] = rows;
  const out = createSheet(PLATE, r1 - r0);
  for (let y = r0; y < r1; y++) {
    for (let x = 0; x < PLATE; x++) out.cells[(y - r0) * PLATE + x] = plateCell(sheet, plate, x, y);
  }
  return out;
}

/** シート全体を左右反転したとき、見た目で同じ位置にくるプレートの番号（同じ行で列を cols-1-col にしたもの）。 */
export function mirrorPlateIndex(plates: Plate[], i: number): number {
  const p = plates[i];
  if (!p) return i;
  const cols = Math.max(...plates.map((q) => q.col)) + 1;
  const target = plates.find((q) => q.row === p.row && q.col === cols - 1 - p.col);
  return target ? target.index : i;
}

/** 左右反転したシートのコピー（サムネイル用）。 */
export function flipX(sheet: Sheet): Sheet {
  const out = createSheet(sheet.width, sheet.height);
  for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) out.cells[y * sheet.width + x] = sheet.cells[y * sheet.width + (sheet.width - 1 - x)];
  return out;
}
