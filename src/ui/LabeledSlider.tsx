import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
  onComplete?(v: number): void;
  testID?: string;
}

export function LabeledSlider({ label, value, min, max, step = 1, onChange, onComplete, testID }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Slider
        testID={testID}
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        minimumTrackTintColor={colors.accent}
        onValueChange={onChange}
        onSlidingComplete={onComplete}
      />
      <Text style={styles.value}>{Math.round(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  label: { width: 96, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  slider: { flex: 1, height: 40 },
  value: { width: 40, textAlign: 'right', fontFamily: fonts.regular, fontSize: 15, color: colors.subtext },
});
