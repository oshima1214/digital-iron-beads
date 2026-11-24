import { StyleSheet, Text, View } from 'react-native';

import { NavButton } from './NavButton';
import { colors, fonts } from './theme';

interface Action {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/** 画面の上の帯。左は戻る、右は次へ進むボタン（塗りつぶし）。 */
export function NavBar({ title, left, right }: { title: string; left?: Action; right?: Action }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.side, { alignItems: 'flex-start' }]}>{left && <NavButton {...left} />}</View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right && <NavButton {...right} primary />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 6 },
  side: { flex: 1 },
  title: { flex: 1.3, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.text },
});
