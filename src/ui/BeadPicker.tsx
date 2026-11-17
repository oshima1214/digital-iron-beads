import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '@/core/palette/perler';

import { BeadChip } from './beads/BeadChip';
import { NavBar } from './NavBar';
import { colors } from './theme';

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

function Chips({ selected, onPress }: { selected: readonly number[]; onPress(i: number): void }) {
  return (
    <ScrollView contentContainerStyle={styles.grid}>
      {PALETTE.map((b) => (
        <Pressable key={b.index} testID={`bead-${b.code}`} accessibilityLabel={`${b.name} ${b.code}`} onPress={() => onPress(b.index)}>
          <BeadChip index={b.index} selected={selected.includes(b.index)} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingBottom: 24 },
});
