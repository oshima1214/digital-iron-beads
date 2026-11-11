import { Canvas, createPicture, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { Sheet } from '@/core/sheet/sheet';

import { sheetLayout } from './sheetGeometry';
import { paintSheet } from './sheetPaint';

interface Props {
  sheet: Sheet;
  /** 描画に使える箱の大きさ。シートはこの中に収まる最大の正方形マスで中央に描く。 */
  width: number;
  height: number;
  testID?: string;
}

export function SheetCanvas({ sheet, width, height, testID }: Props) {
  const layout = sheetLayout(sheet, width, height);
  const picture = useMemo(
    () => createPicture((c) => paintSheet(c, sheet, layout.cell), { width: layout.width, height: layout.height }),
    [sheet, layout.cell, layout.width, layout.height],
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
