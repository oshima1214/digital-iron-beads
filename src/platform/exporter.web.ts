// Web（自動テスト用）: 共有はダウンロード、印刷は新しいタブで HTML を開く。
import { BEADS_EXT, BEADS_MIME } from '@/core/appIdentity';
import { pngLayout } from '@/core/export/pngLayout';
import { beadByIndex } from '@/core/palette/perler';
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

/** ビーズシートと、その下に必要なビーズの一覧を描いた PNG（Web では canvas で作ってダウンロード）。 */
export async function sharePng(sheet: Sheet, name: string): Promise<void> {
  const L = pngLayout(sheet, PNG_CELL_PX);
  const c = document.createElement('canvas');
  c.width = Math.ceil(L.width);
  c.height = Math.ceil(L.height);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < sheet.cells.length; i++) {
    const v = sheet.cells[i];
    if (!v) continue;
    ctx.fillStyle = `rgb(${beadByIndex(v).rgb.join(',')})`;
    ctx.beginPath();
    const x = i % sheet.width;
    ctx.arc(L.sheet.x + (x + 0.5) * PNG_CELL_PX, L.sheet.y + (Math.floor(i / sheet.width) + 0.5) * PNG_CELL_PX, PNG_CELL_PX * 0.49, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1C1C1E';
  ctx.font = `${L.title.size}px BIZUDPGothic_700Bold, sans-serif`;
  ctx.fillText(L.title.text, L.title.x, L.title.y + L.title.size * 0.85);
  for (const it of L.items) {
    const cy = it.y + L.rowH / 2;
    const base = cy + L.textSize * 0.35;
    ctx.fillStyle = `rgb(${beadByIndex(it.index).rgb.join(',')})`;
    ctx.beginPath();
    ctx.arc(it.x + 12, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C7C7CC';
    ctx.stroke();
    ctx.fillStyle = '#1C1C1E';
    ctx.font = `${L.textSize}px BIZUDPGothic_700Bold, sans-serif`;
    ctx.fillText(it.name, it.x + 32, base);
    const nameW = ctx.measureText(it.name).width;
    const countW = ctx.measureText(it.count).width;
    ctx.fillText(it.count, it.x + L.colW - 16 - countW, base);
    ctx.fillStyle = '#6E6E73';
    ctx.font = `${L.textSize * 0.8}px BIZUDPGothic_400Regular, sans-serif`;
    ctx.fillText(it.code, it.x + 34 + nameW, base);
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
