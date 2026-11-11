// Web（自動テスト用）: canvas でデコード・エンコードする。
import type { RgbaImage } from '@/core/convert/types';
import { resizeMax } from '@/core/image/adjust';

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image could not be loaded'));
    img.src = uri;
  });
}

export async function loadRgba(uri: string, maxSide = 2048): Promise<RgbaImage> {
  const el = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = el.naturalWidth;
  canvas.height = el.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  ctx.drawImage(el, 0, 0);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return resizeMax({ width: d.width, height: d.height, data: d.data }, maxSide);
}

export async function encodePng(img: RgbaImage): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('image could not be encoded');
  return new Uint8Array(await blob.arrayBuffer());
}
