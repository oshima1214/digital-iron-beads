import { createSheet, type Sheet } from './sheet';

/** テスト用: 行の配列からシートを作る。 */
export function sheetFrom(rows: number[][]): Sheet {
  const s = createSheet(rows[0].length, rows.length);
  rows.forEach((row, y) => row.forEach((v, x) => (s.cells[y * s.width + x] = v)));
  return s;
}
