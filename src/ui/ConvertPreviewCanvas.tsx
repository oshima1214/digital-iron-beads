import { Canvas, createPicture, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ConvertPreview } from '@/state/draft';

import { SheetCanvas } from './SheetCanvas';
import { sheetLayout } from './sheetGeometry';
import { paintOriginal } from './sheetPaint';
import { colors, fonts } from './theme';

/** ビーズ化の画面のプレビュー（元の色・ビーズ・手持ちが0色）。 */
export function ConvertPreviewCanvas({ preview, width, height, testID }: { preview: ConvertPreview; width: number; height: number; testID?: string }) {
  if (preview.kind === 'beads') return <SheetCanvas testID={testID} sheet={preview.sheet} width={width} height={height} />;
  if (preview.kind === 'no-beads')
    return (
      <View testID={testID} style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>手持ちのビーズが選ばれていません。{'\n'}「使うビーズ」の「…」から選んでください</Text>
      </View>
    );
  return <OriginalCanvas testID={testID} preview={preview} width={width} height={height} />;
}

function OriginalCanvas({ preview, width, height, testID }: { preview: Extract<ConvertPreview, { kind: 'original' }>; width: number; height: number; testID?: string }) {
  const image = preview.image;
  const layout = sheetLayout(image, width, height);
  const picture = useMemo(() => createPicture((c) => paintOriginal(c, image, layout.cell), { width: layout.width, height: layout.height }), [image, layout.cell, layout.width, layout.height]);
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

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.subtext, textAlign: 'center', lineHeight: 22 },
});
