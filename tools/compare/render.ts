import type { RgbaImage } from '../../src/core/convert/types';
import { beadByIndex } from '../../src/core/palette/perler32';
import type { Sheet } from '../../src/core/sheet/sheet';

/** シートを 1マス cellPx の画像に描く（ビーズは丸、白ビーズは灰色の縁、背景は小さな点）。 */
export function renderSheet(sheet: Sheet, cellPx = 12): RgbaImage {
  const W = sheet.width * cellPx;
  const H = sheet.height * cellPx;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const r = cellPx * 0.49;
  const ring = Math.max(1, cellPx * 0.08);
  for (let cy = 0; cy < sheet.height; cy++) {
    for (let cx = 0; cx < sheet.width; cx++) {
      const v = sheet.cells[cy * sheet.width + cx];
      const ox = cx * cellPx + cellPx / 2;
      const oy = cy * cellPx + cellPx / 2;
      for (let y = cy * cellPx; y < (cy + 1) * cellPx; y++) {
        for (let x = cx * cellPx; x < (cx + 1) * cellPx; x++) {
          const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
          let c: readonly number[] | null = null;
          if (v === 0) {
            if (d <= cellPx * 0.1) c = [199, 199, 204];
          } else if (d <= r) {
            const rgb = beadByIndex(v).rgb;
            c = v === 1 && d >= r - ring ? [190, 190, 196] : rgb;
          }
          if (c) data.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
        }
      }
    }
  }
  return { width: W, height: H, data };
}
