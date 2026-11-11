// iOS: ImageManipulator で縮小して PNG にし、Skia でデコードして RGBA を読む。
import { AlphaType, ColorType, ImageFormat, Skia } from '@shopify/react-native-skia';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { RgbaImage } from '@/core/convert/types';

export async function loadRgba(uri: string, maxSide = 2048): Promise<RgbaImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const long = Math.max(probe.width, probe.height);
  const ref = long > maxSide ? await ctx.resize(probe.width >= probe.height ? { width: maxSide } : { height: maxSide }).renderAsync() : probe;
  const saved = await ref.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!saved.base64) throw new Error('image could not be encoded');
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(saved.base64));
  if (!img) throw new Error('image could not be decoded');
  const width = img.width();
  const height = img.height();
  const px = img.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px || px instanceof Float32Array) throw new Error('pixels could not be read');
  return { width, height, data: new Uint8ClampedArray(px.buffer, px.byteOffset, px.length) };
}

export async function encodePng(img: RgbaImage): Promise<Uint8Array> {
  const data = Skia.Data.fromBytes(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.length));
  const sk = Skia.Image.MakeImage(
    { width: img.width, height: img.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    data,
    img.width * 4,
  );
  if (!sk) throw new Error('image could not be created');
  return sk.encodeToBytes(ImageFormat.PNG);
}
