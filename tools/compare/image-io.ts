import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import type { RgbaImage } from '../../src/core/convert/types';

export function readImage(path: string): RgbaImage {
  const buf = fs.readFileSync(path);
  if (/\.jpe?g$/i.test(path)) {
    const j = jpeg.decode(buf, { useTArray: true });
    return { width: j.width, height: j.height, data: new Uint8ClampedArray(j.data.buffer, j.data.byteOffset, j.data.length) };
  }
  const p = PNG.sync.read(buf);
  return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data.buffer, p.data.byteOffset, p.data.length) };
}

export function encodePng(img: RgbaImage): Buffer {
  const p = new PNG({ width: img.width, height: img.height });
  p.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length);
  return PNG.sync.write(p);
}
