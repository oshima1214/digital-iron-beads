import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { beadByIndex } from '@/core/palette/perler';

import { colors, fonts } from '../theme';

const rgb = (i: number) => {
  const [r, g, b] = beadByIndex(i).rgb;
  return `rgb(${r},${g},${b})`;
};

export const CHIP_W = 72;
export const CHIP_H = 66;

/** ビーズの札（色・色の名前・品番）。色の名前のほうをよく見るので上に大きく出す。 */
export function BeadChip({ index, selected, recommended, dimmed, style }: { index: number; selected: boolean; recommended?: boolean; dimmed?: boolean; style?: ViewStyle }) {
  const b = beadByIndex(index);
  return (
    <View style={[styles.chip, selected && styles.chipOn, dimmed && { opacity: 0.2 }, style]}>
      <View style={[styles.swatch, { backgroundColor: rgb(index) }]} />
      <Text style={styles.name} numberOfLines={1}>
        {b.name}
      </Text>
      <Text style={styles.code} numberOfLines={1}>
        {b.code}
      </Text>
      {recommended && <View style={styles.rec} />}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: CHIP_W,
    height: CHIP_H,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipOn: { borderColor: colors.accent },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  name: { fontFamily: fonts.bold, fontSize: 11, color: colors.text, marginTop: 2 },
  code: { fontFamily: fonts.regular, fontSize: 9, color: colors.subtext },
  rec: { position: 'absolute', right: 5, top: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
