// Web（自動テスト用）: canvas 2D で文字の形を描く（フォントは expo-font で読み込み済みの BIZ UDPゴシック Bold）。
import type { TextLayout } from '@/core/text/layout';

export const GLYPH_SCALE = 0.88;
const FAMILY = 'BIZUDPGothic_700Bold';

export async function renderTextMask(text: string, layout: TextLayout, cellPx: number): Promise<{ mask: Uint8Array; w: number; h: number }> {
  const w = layout.totalW * cellPx;
  const h = layout.charH * cellPx;
  const size = layout.charH * cellPx * GLYPH_SCALE;
  const font = `${size}px ${FAMILY}`;
  try {
    await document.fonts.load(font, text);
  } catch {
    // 読み込めなくても既定のフォントで描く
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  let x = 0;
  [...text].forEach((ch, i) => {
    const box = layout.widths[i] * cellPx;
    ctx.fillText(ch, x + box / 2, h / 2);
    x += box;
  });
  const d = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3];
  return { mask, w, h };
}
