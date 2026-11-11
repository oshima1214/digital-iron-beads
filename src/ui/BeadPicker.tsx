import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALL32, BASIC16, beadByIndex, PERLER32 } from '@/core/palette/perler32';

import { NavBar } from './NavBar';
import { Segmented } from './Segmented';
import { colors, fonts } from './theme';

const rgb = (i: number) => {
  const [r, g, b] = beadByIndex(i).rgb;
  return `rgb(${r},${g},${b})`;
};

type Mode = 'basic' | 'all' | 'custom';

function modeOf(sel: readonly number[]): Mode {
  const s = [...sel].sort((a, b) => a - b).join();
  if (s === [...BASIC16].sort((a, b) => a - b).join()) return 'basic';
  if (s === ALL32.join()) return 'all';
  return 'custom';
}

export function beadSetLabel(sel: readonly number[]): string {
  const m = modeOf(sel);
  return m === 'basic' ? '基本16色' : m === 'all' ? '全32色' : `手持ち ${sel.length}色`;
}

interface MultiProps {
  visible: boolean;
  value: readonly number[];
  onClose(v: number[]): void;
}

/** 使うビーズを選ぶ（複数）。最低1色。 */
export function BeadSetPicker({ visible, value, onClose }: MultiProps) {
  const [sel, setSel] = useState<number[]>([...value]);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSel([...value]);
  }
  const mode = modeOf(sel);
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? (s.length > 1 ? s.filter((x) => x !== i) : s) : [...s, i]));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(sel)}>
      <SafeAreaView style={styles.root}>
        <NavBar title="使うビーズ" right={{ title: '完了', testID: 'beads-done', onPress: () => onClose(sel) }} />
        <View style={styles.center}>
          <Segmented<Mode>
            options={[
              { value: 'basic', label: '基本16色' },
              { value: 'all', label: '全32色' },
              { value: 'custom', label: '手持ちを選ぶ' },
            ]}
            value={mode}
            onChange={(m) => setSel(m === 'basic' ? [...BASIC16] : m === 'all' ? [...ALL32] : [...sel])}
          />
        </View>
        <Text style={styles.hint}>タップで選ぶ・外す（{sel.length}色）</Text>
        <Chips selected={sel} onPress={toggle} />
      </SafeAreaView>
    </Modal>
  );
}

/** ビーズを1色選ぶ。 */
export function BeadOnePicker({ visible, title, value, onClose }: { visible: boolean; title: string; value: number; onClose(v: number): void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(value)}>
      <SafeAreaView style={styles.root}>
        <NavBar title={title} right={{ title: '閉じる', onPress: () => onClose(value) }} />
        <Chips selected={[value]} onPress={(i) => onClose(i)} />
      </SafeAreaView>
    </Modal>
  );
}

function Chips({ selected, onPress }: { selected: readonly number[]; onPress(i: number): void }) {
  return (
    <View style={styles.grid}>
      {PERLER32.map((b) => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  center: { alignItems: 'center', marginVertical: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { width: 72, minHeight: 64, alignItems: 'center', padding: 4, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: colors.accent },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  code: { fontFamily: fonts.bold, fontSize: 11, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 10, color: colors.subtext },
});
