// Web（自動テスト用）: 共有はダウンロード、印刷は新しいタブで HTML を開く。
import { BEADS_EXT, BEADS_MIME } from '@/core/appIdentity';
import type { Sheet } from '@/core/sheet/sheet';

export const PNG_CELL_PX = 24;
export const safeName = (name: string) => name.replace(/[\\/:*?"<>|\n\r]/g, '_').trim() || '作品';

function download(bytes: Uint8Array | string, fileName: string, type: string) {
  const blob = new Blob([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function sharePng(sheet: Sheet, name: string, mirror: boolean): Promise<void> {
  // Web では Skia の Surface を使わず、1マス1色の簡易 PNG を canvas で作る
  const c = document.createElement('canvas');
  c.width = sheet.width * PNG_CELL_PX;
  c.height = sheet.height * PNG_CELL_PX;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  const { beadByIndex } = await import('@/core/palette/perler32');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < sheet.cells.length; i++) {
    const v = sheet.cells[i];
    if (!v) continue;
    ctx.fillStyle = `rgb(${beadByIndex(v).rgb.join(',')})`;
    ctx.beginPath();
    const x = i % sheet.width;
    ctx.arc(((mirror ? sheet.width - 1 - x : x) + 0.5) * PNG_CELL_PX, (Math.floor(i / sheet.width) + 0.5) * PNG_CELL_PX, PNG_CELL_PX * 0.49, 0, Math.PI * 2);
    ctx.fill();
  }
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('image could not be encoded');
  download(new Uint8Array(await blob.arrayBuffer()), `${safeName(name)}.png`, 'image/png');
}

export async function printPdf(html: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('popup blocked');
  w.document.write(html);
  w.document.close();
}

export async function sharePdf(html: string, name: string): Promise<void> {
  download(html, `${safeName(name)}.html`, 'text/html');
}

export async function shareBeads(bytes: Uint8Array, name: string): Promise<void> {
  download(bytes, `${safeName(name)}.${BEADS_EXT}`, BEADS_MIME);
}

export async function shareText(text: string): Promise<void> {
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  download(text, 'beads.txt', 'text/plain');
}
