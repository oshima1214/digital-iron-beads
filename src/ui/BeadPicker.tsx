import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { beadByIndex, FAMILIES, PALETTE } from '@/core/palette/perler';

import { NavBar } from './NavBar';
import { colors, fonts } from './theme';

const rgb = (i: number) => {
  const [r, g, b] = beadByIndex(i).rgb;
  return `rgb(${r},${g},${b})`;
};

/** ビーズを1色選ぶ。onClose は色を押したとき、onCancel は閉じる・スワイプで閉じたとき（なければ今の値で onClose）。 */
export function BeadOnePicker({
  visible,
  title,
  value,
  onClose,
  onCancel,
}: {
  visible: boolean;
  title: string;
  value: number;
  onClose(v: number): void;
  onCancel?(): void;
}) {
  const cancel = () => (onCancel ? onCancel() : onClose(value));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <SafeAreaView style={styles.root}>
        <NavBar title={title} right={{ title: '閉じる', testID: 'picker-close', onPress: cancel }} />
        <Chips selected={[value]} onPress={(i) => onClose(i)} />
      </SafeAreaView>
    </Modal>
  );
}

// 64色を系統ごとの順に並べる
const ORDERED = FAMILIES.flatMap((f) => f.codes.map((code) => PALETTE.find((b) => b.code === code)!));

function Chips({ selected, onPress }: { selected: readonly number[]; onPress(i: number): void }) {
  return (
    <ScrollView contentContainerStyle={styles.grid}>
      {ORDERED.map((b) => {
        const on = selected.includes(b.index);
        return (
          <Pressable key={b.index} testID={`bead-${b.code}`} accessibilityLabel={`${b.code} ${b.name}`} onPress={() => onPress(b.index)} style={[styles.chip, on && styles.chipOn]}>
            <View style={[styles.swatch, { backgroundColor: rgb(b.index) }]} />
            <Text style={styles.code}>{b.code}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {b.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingBottom: 24 },
  chip: { width: 72, minHeight: 64, alignItems: 'center', padding: 4, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: colors.accent },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  code: { fontFamily: fonts.bold, fontSize: 11, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 10, color: colors.subtext },
});
