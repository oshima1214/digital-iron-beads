import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fonts } from './theme';

/**
 * 画面の上の、移動・操作のボタン（‹ 戻る、編集、メニュー など）。
 * 子どもでも押しやすいよう、色の付いた丸い札にして文字も大きくする（前の文字だけのボタンのおよそ2倍）。
 */
export function NavButton({
  title,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
  primary,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** 次へ進むボタン（塗りつぶし） */
  primary?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.off, pressed && styles.pressed, style]}>
      <Text style={[styles.text, primary && styles.textPrimary]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export const NAV_BUTTON_HEIGHT = 44;

const styles = StyleSheet.create({
  button: {
    minHeight: NAV_BUTTON_HEIGHT,
    minWidth: NAV_BUTTON_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: NAV_BUTTON_HEIGHT / 2,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  off: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  text: { fontFamily: fonts.bold, fontSize: 19, color: colors.accent },
  textPrimary: { color: '#FFFFFF' },
});
