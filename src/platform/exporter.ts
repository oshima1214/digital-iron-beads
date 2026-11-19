// iOS: ファイルを cache に書いて共有シートで渡す（写真への保存も共有シートから）。
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { BEADS_MIME, BEADS_UTI, BEADS_EXT } from '@/core/appIdentity';
import { pngLayout } from '@/core/export/pngLayout';
import { beadByIndex } from '@/core/palette/perler';
import type { Sheet } from '@/core/sheet/sheet';
import { paintSheet } from '@/ui/sheetPaint';

import { loadTypeface } from './skiaFonts';

export const PNG_CELL_PX = 24;

/** ファイル名に使えない文字を除く */
export const safeName = (name: string) => name.replace(/[\\/:*?"<>|\n\r]/g, '_').trim() || '作品';

async function writeCache(fileName: string, bytes: Uint8Array): Promise<string> {
  const f = new File(Paths.cache, fileName);
  if (f.exists) f.delete();
  f.create();
  await f.write(bytes);
  return f.uri;
}

/** ビーズシートと、その下に必要なビーズの一覧（色の丸・色名（品番）・数）を描いた PNG を共有する。 */
export async function sharePng(sheet: Sheet, name: string): Promise<void> {
  const L = pngLayout(sheet, PNG_CELL_PX);
  const surface = Skia.Surface.Make(Math.ceil(L.width), Math.ceil(L.height));
  if (!surface) throw new Error('surface could not be created');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('#FFFFFF'));
  canvas.drawRect(Skia.XYWHRect(0, 0, L.width, L.height), paint);
  canvas.save();
  canvas.translate(L.sheet.x, L.sheet.y);
  paintSheet(canvas, sheet, PNG_CELL_PX);
  canvas.restore();

  const bold = Skia.Font(await loadTypeface('bold'), L.textSize);
  const regular = Skia.Font(await loadTypeface('regular'), L.textSize * 0.8);
  const title = Skia.Font(await loadTypeface('bold'), L.title.size);
  const text = Skia.Paint();
  text.setAntiAlias(true);
  text.setColor(Skia.Color('#1C1C1E'));
  const sub = Skia.Paint();
  sub.setAntiAlias(true);
  sub.setColor(Skia.Color('#6E6E73'));
  const ring = Skia.Paint();
  ring.setAntiAlias(true);
  ring.setStyle(1);
  ring.setStrokeWidth(1);
  ring.setColor(Skia.Color('#C7C7CC'));
  canvas.drawText(L.title.text, L.title.x, L.title.y + L.title.size * 0.85, text, title);
  for (const it of L.items) {
    const cy = it.y + L.rowH / 2;
    const base = cy + L.textSize * 0.35;
    const [r, g, b] = beadByIndex(it.index).rgb;
    paint.setColor(Skia.Color(`rgb(${r},${g},${b})`));
    canvas.drawCircle(it.x + 12, cy, 11, paint);
    canvas.drawCircle(it.x + 12, cy, 11, ring);
    canvas.drawText(it.name, it.x + 32, base, text, bold);
    canvas.drawText(it.code, it.x + 34 + bold.measureText(it.name).width, base, sub, regular);
    canvas.drawText(it.count, it.x + L.colW - 16 - bold.measureText(it.count).width, base, text, bold);
  }
  surface.flush();
  const uri = await writeCache(`${safeName(name)}.png`, surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG));
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
}

export async function printPdf(html: string): Promise<void> {
  await Print.printAsync({ html });
}

export async function sharePdf(html: string, name: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const target = new File(Paths.cache, `${safeName(name)}.pdf`);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}

export async function shareBeads(bytes: Uint8Array, name: string): Promise<void> {
  const uri = await writeCache(`${safeName(name)}.${BEADS_EXT}`, bytes);
  await Sharing.shareAsync(uri, { mimeType: BEADS_MIME, UTI: BEADS_UTI });
}
