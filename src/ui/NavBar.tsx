import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

interface Action {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

export function NavBar({ title, left, right }: { title: string; left?: Action; right?: Action }) {
  const item = (a: Action | undefined, align: 'flex-start' | 'flex-end') => (
    <View style={[styles.side, { alignItems: align }]}>
      {a && (
        <Pressable accessibilityRole="button" testID={a.testID} onPress={a.onPress} disabled={a.disabled} hitSlop={8} style={styles.hit}>
          <Text style={[styles.action, a.disabled && { opacity: 0.4 }]}>{a.title}</Text>
        </Pressable>
      )}
    </View>
  );
  return (
    <View style={styles.bar}>
      {item(left, 'flex-start')}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {item(right, 'flex-end')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 48, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1 },
  hit: { minHeight: 44, justifyContent: 'center' },
  title: { flex: 2, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  action: { fontFamily: fonts.regular, fontSize: 17, color: colors.accent },
});
