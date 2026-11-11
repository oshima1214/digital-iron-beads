import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

interface Props<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
  testID?: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, testID }: Props<T>) {
  return (
    <View style={styles.wrap} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && styles.itemOn]}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.separator, borderRadius: 9, padding: 2 },
  item: { minHeight: 32, minWidth: 40, paddingHorizontal: 8, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.panel, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  text: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  textOn: { fontFamily: fonts.bold },
});
