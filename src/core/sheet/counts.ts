import { type Plate, plateCell } from './plates';
import { PLATE, type Sheet } from './sheet';

export interface BeadCount {
  index: number;
  count: number;
}

/** count の降順（同数は index の昇順）。背景 0 は含めない。 */
export function countBeads(sheet: Sheet, plate?: Plate): BeadCount[] {
  const counts = new Map<number, number>();
  const add = (v: number) => {
    if (v !== 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  };
  if (plate) {
    for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) add(plateCell(sheet, plate, x, y));
  } else {
    for (const v of sheet.cells) add(v);
  }
  return [...counts]
    .map(([index, count]) => ({ index, count }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
}
