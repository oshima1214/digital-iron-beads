import { Pressable, StyleSheet, View } from 'react-native';

import { type Plate, plateSheet } from '@/core/sheet/plates';
import type { Sheet } from '@/core/sheet/sheet';

import { SheetThumb } from './SheetThumb';
import { colors } from './theme';

/** プレートの格子（2×2・4×4）。今のプレートは青い枠。タップで切り替える。 */
export function PlateMiniMap({ sheet, plates, current, size, onSelect }: { sheet: Sheet; plates: Plate[]; current: number; size: number; onSelect(i: number): void }) {
  const cols = Math.max(...plates.map((p) => p.col)) + 1;
  const tile = Math.floor((size - (cols - 1) * 3) / cols);
  return (
    <View style={[styles.grid, { width: size }]}>
      {plates.map((p) => (
        <Pressable
          key={p.index}
          accessibilityRole="button"
          accessibilityLabel={`プレート ${p.index + 1}`}
          testID={`plate-${p.index + 1}`}
          onPress={() => onSelect(p.index)}
          style={[styles.tile, { width: tile, height: tile }, p.index === current && styles.on]}>
          <SheetThumb sheet={plateSheet(sheet, p)} size={tile - 4} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  tile: { borderWidth: 2, borderColor: colors.separator, borderRadius: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  on: { borderColor: colors.accent },
});
