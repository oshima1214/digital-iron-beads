import { Canvas, createPicture, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { Sheet } from '@/core/sheet/sheet';

import { sheetLayout } from './sheetGeometry';
import { type PaintOptions, paintSheet } from './sheetPaint';

interface Props {
  sheet: Sheet;
  /** 描画に使える箱の大きさ。シートはこの中に収まる最大の正方形マスで中央に描く。 */
  width: number;
  height: number;
  mirror?: boolean;
  styleMode?: PaintOptions['style'];
  /** 制作ナビで強調する色 */
  focus?: number;
  /** シートをその場で書き換えたときに増やす（同じ参照でも描き直す） */
  version?: number;
  testID?: string;
}

export function SheetCanvas({ sheet, width, height, mirror, styleMode, focus, version = 0, testID }: Props) {
  const layout = sheetLayout(sheet, width, height);
  const picture = useMemo(
    () => createPicture((c) => paintSheet(c, sheet, layout.cell, { mirror, style: styleMode, focus }), { width: layout.width, height: layout.height }),
    // version はシートの中身が変わったことを知らせるためだけの依存
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, layout.cell, layout.width, layout.height, mirror, styleMode, focus, version],
  );
  return (
    <View testID={testID} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {layout.cell > 0 && (
        <Canvas style={{ width: layout.width, height: layout.height }}>
          <Picture picture={picture} />
        </Canvas>
      )}
    </View>
  );
}
