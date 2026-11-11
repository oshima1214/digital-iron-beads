import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

export function SettingRow({ label, children, onPress, last, testID }: { label: string; children?: ReactNode; onPress?: () => void; last?: boolean; testID?: string }) {
  const body = (
    <View style={[styles.row, !last && styles.border]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" testID={testID} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function RowValue({ text }: { text: string }) {
  return <Text style={styles.value}>{text} ›</Text>;
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  label: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  control: { flex: 1, alignItems: 'flex-end' },
  value: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext },
});
