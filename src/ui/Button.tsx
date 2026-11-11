import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fonts } from './theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain';
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', disabled, style, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, styles[variant], disabled && styles.disabled, pressed && styles.pressed, style]}>
      <Text style={[styles.text, variant === 'primary' ? styles.textPrimary : styles.textAccent]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  plain: { backgroundColor: 'transparent', minHeight: 44 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  text: { fontFamily: fonts.bold, fontSize: 16 },
  textPrimary: { color: '#FFFFFF' },
  textAccent: { color: colors.accent },
});
