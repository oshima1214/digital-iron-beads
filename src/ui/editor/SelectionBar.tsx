import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { editorStore, useEditor } from '@/state/editor';

import { colors, fonts } from '../theme';

export const SELECTION_BAR_HEIGHT = 48;

export function SelectionBar() {
  const count = useEditor((s) => s.selection.size);
  const rangeMode = useEditor((s) => s.rangeMode);
  const st = () => editorStore().getState();
  const action = (label: string, testID: string, onPress: () => void, danger?: boolean) => (
    <Pressable accessibilityRole="button" testID={testID} disabled={count === 0} onPress={onPress} style={[styles.action, count === 0 && { opacity: 0.4 }]}>
      <Text style={[styles.actionText, danger && { color: '#FF3B30' }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.bar}>
      <View style={styles.range}>
        <Text style={styles.label}>範囲</Text>
        <Switch testID="range-mode" value={rangeMode} onValueChange={(v) => st().setRangeMode(v)} />
      </View>
      <Text style={styles.count} testID="selection-count">
        {count}マス
      </Text>
      {action('選んだ色にする', 'sel-recolor', () => st().recolorSelection())}
      {action('削除', 'sel-delete', () => st().deleteSelection(), true)}
      {action('解除', 'sel-clear', () => st().clearSelection())}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: SELECTION_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 6 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, minWidth: 40 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
});
