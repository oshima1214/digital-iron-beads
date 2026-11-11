import { type SkCanvas, Skia } from '@shopify/react-native-skia';

import { beadByIndex } from '@/core/palette/perler32';
import { PLATE, type Sheet } from '@/core/sheet/sheet';

export const SHEET_COLORS = {
  background: '#FFFFFF',
  dot: '#C7C7CC',
  whiteRing: '#C7C7CC',
  grid: '#E5E5EA',
  plate: '#AEAEB2',
} as const;

const hex = (rgb: readonly number[]) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

/** 仕様書 §6.4 のシート描画。cell はマスの大きさ（px）。 */
export function paintSheet(canvas: SkCanvas, sheet: Sheet, cell: number): void {
  const W = sheet.width * cell;
  const H = sheet.height * cell;
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(SHEET_COLORS.background));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), fill);

  const ring = Skia.Paint();
  ring.setAntiAlias(true);
  ring.setStyle(1); // Stroke
  ring.setStrokeWidth(1);
  ring.setColor(Skia.Color(SHEET_COLORS.whiteRing));

  const colorCache = new Map<number, ReturnType<typeof Skia.Color>>();
  const colorOf = (v: number) => {
    let c = colorCache.get(v);
    if (!c) {
      c = Skia.Color(v === 0 ? SHEET_COLORS.dot : hex(beadByIndex(v).rgb));
      colorCache.set(v, c);
    }
    return c;
  };

  const r = (cell * 0.98) / 2;
  const dot = (cell * 0.14) / 2;
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const v = sheet.cells[y * sheet.width + x];
      const cx = (x + 0.5) * cell;
      const cy = (y + 0.5) * cell;
      fill.setColor(colorOf(v));
      if (v === 0) {
        canvas.drawCircle(cx, cy, Math.max(0.5, dot), fill);
      } else {
        canvas.drawCircle(cx, cy, r, fill);
        if (v === 1) canvas.drawCircle(cx, cy, r - 0.5, ring);
      }
    }
  }

  if (cell >= 4) {
    const grid = Skia.Paint();
    grid.setStyle(1);
    grid.setStrokeWidth(0.5);
    grid.setColor(Skia.Color(SHEET_COLORS.grid));
    for (let i = 0; i <= sheet.width; i++) canvas.drawLine(i * cell, 0, i * cell, H, grid);
    for (let i = 0; i <= sheet.height; i++) canvas.drawLine(0, i * cell, W, i * cell, grid);
  }
  const plate = Skia.Paint();
  plate.setStyle(1);
  plate.setStrokeWidth(1.5);
  plate.setColor(Skia.Color(SHEET_COLORS.plate));
  for (let i = PLATE; i < sheet.width; i += PLATE) canvas.drawLine(i * cell, 0, i * cell, H, plate);
  for (let i = PLATE; i < sheet.height; i += PLATE) canvas.drawLine(0, i * cell, W, i * cell, plate);
}

/** 1マス1ピクセルの RGBA（サムネイル用）。背景は白。 */
export function sheetPixels(sheet: Sheet): Uint8Array {
  const out = new Uint8Array(sheet.width * sheet.height * 4);
  for (let i = 0; i < sheet.cells.length; i++) {
    const v = sheet.cells[i];
    const rgb = v === 0 ? [255, 255, 255] : beadByIndex(v).rgb;
    out.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  return out;
}
