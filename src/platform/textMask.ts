// iOS: Skia で BIZ UDPゴシック Bold を使い、オフスクリーンで文字の形を描く。
import { BIZUDPGothic_700Bold } from '@expo-google-fonts/biz-udpgothic';
import { ColorType, AlphaType, type SkTypeface, Skia } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';

import type { TextLayout } from '@/core/text/layout';

export const GLYPH_SCALE = 0.88;
let typeface: SkTypeface | null = null;

async function loadTypeface(): Promise<SkTypeface> {
  if (typeface) return typeface;
  const asset = Asset.fromModule(BIZUDPGothic_700Bold);
  await asset.downloadAsync();
  const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  if (!tf) throw new Error('font could not be loaded');
  typeface = tf;
  return tf;
}

/** 各文字を、その文字の幅の箱の中央に描いた不透明度（0..255、行優先）。 */
export async function renderTextMask(text: string, layout: TextLayout, cellPx: number): Promise<{ mask: Uint8Array; w: number; h: number }> {
  const w = layout.totalW * cellPx;
  const h = layout.charH * cellPx;
  const font = Skia.Font(await loadTypeface(), layout.charH * cellPx * GLYPH_SCALE);
  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error('surface could not be created');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('black'));
  paint.setAntiAlias(true);
  const m = font.getMetrics();
  const baseline = (h - (m.descent - m.ascent)) / 2 - m.ascent;
  let x = 0;
  [...text].forEach((ch, i) => {
    const box = layout.widths[i] * cellPx;
    const r = font.measureText(ch);
    canvas.drawText(ch, x + (box - r.width) / 2 - r.x, baseline, paint, font);
    x += box;
  });
  surface.flush();
  const px = surface.makeImageSnapshot().readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px || px instanceof Float32Array) throw new Error('pixels could not be read');
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = 255 - px[i * 4]; // 白地に黒 → 黒さを不透明度に
  return { mask, w, h };
}
