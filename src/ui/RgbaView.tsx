import { AlphaType, Canvas, ColorType, Image, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { RgbaImage } from '@/core/convert/types';

/** メモリ上の RGBA 画像をそのまま描く。 */
export function RgbaView({ image, width, height }: { image: RgbaImage; width: number; height: number }) {
  const sk = useMemo(
    () =>
      Skia.Image.MakeImage(
        { width: image.width, height: image.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
        Skia.Data.fromBytes(new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length)),
        image.width * 4,
      ),
    [image],
  );
  return <Canvas style={{ width, height }}>{sk && <Image image={sk} x={0} y={0} width={width} height={height} fit="fill" />}</Canvas>;
}
