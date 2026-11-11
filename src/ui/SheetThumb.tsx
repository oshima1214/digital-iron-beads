import { AlphaType, Canvas, ColorType, FilterMode, Image, MipmapMode, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Sheet } from '@/core/sheet/sheet';

import { sheetPixels } from './sheetPaint';

/** 1マスを1ピクセルとして描き、最近傍で拡大する軽量サムネイル。 */
export function SheetThumb({ sheet, size }: { sheet: Sheet; size: number }) {
  const image = useMemo(
    () =>
      Skia.Image.MakeImage(
        { width: sheet.width, height: sheet.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
        Skia.Data.fromBytes(sheetPixels(sheet)),
        sheet.width * 4,
      ),
    [sheet],
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      {image && (
        <Image
          image={image}
          x={0}
          y={0}
          width={size}
          height={size}
          fit="contain"
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
        />
      )}
    </Canvas>
  );
}
