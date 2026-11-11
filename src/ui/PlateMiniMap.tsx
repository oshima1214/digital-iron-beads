import { Pressable, StyleSheet, View } from 'react-native';

import { flipX, mirrorPlateIndex, type Plate, plateSheet } from '@/core/sheet/plates';
import type { Sheet } from '@/core/sheet/sheet';

import { SheetThumb } from './SheetThumb';
import { colors } from './theme';

/**
 * プレートの格子（2×2・4×4）。今のプレートは青い枠。タップで切り替える。
 * mirror のときはシート全体を反転した見た目で並べる（左上のタイル＝データ上の右上のプレート）。onSelect にはデータ上の番号を渡す。
 */
export function PlateMiniMap({
  sheet,
  plates,
  current,
  size,
  mirror = false,
  onSelect,
}: {
  sheet: Sheet;
  plates: Plate[];
  current: number;
  size: number;
  mirror?: boolean;
  onSelect(i: number): void;
}) {
  const cols = Math.max(...plates.map((p) => p.col)) + 1;
  const tile = Math.floor((size - (cols - 1) * 3) / cols);
  return (
    <View style={[styles.grid, { width: size }]}>
      {plates.map((visual) => {
        const p = mirror ? plates[mirrorPlateIndex(plates, visual.index)] : visual;
        const thumb = plateSheet(sheet, p);
        return (
          <Pressable
            key={visual.index}
            accessibilityRole="button"
            accessibilityLabel={`プレート ${visual.index + 1}`}
            testID={`plate-${visual.index + 1}`}
            onPress={() => onSelect(p.index)}
            style={[styles.tile, { width: tile, height: tile }, p.index === current && styles.on]}>
            <SheetThumb sheet={mirror ? flipX(thumb) : thumb} size={tile - 4} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  tile: { borderWidth: 2, borderColor: colors.separator, borderRadius: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  on: { borderColor: colors.accent },
});
