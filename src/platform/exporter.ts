// iOS: ファイルを cache に書いて共有シートで渡す（写真への保存も共有シートから）。
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { BEADS_MIME, BEADS_UTI, BEADS_EXT } from '@/core/appIdentity';
import type { Sheet } from '@/core/sheet/sheet';
import { paintSheet } from '@/ui/sheetPaint';

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

export async function sharePng(sheet: Sheet, name: string, mirror: boolean): Promise<void> {
  const surface = Skia.Surface.Make(sheet.width * PNG_CELL_PX, sheet.height * PNG_CELL_PX);
  if (!surface) throw new Error('surface could not be created');
  paintSheet(surface.getCanvas(), sheet, PNG_CELL_PX, { mirror });
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

export async function shareText(text: string): Promise<void> {
  await Share.share({ message: text });
}
