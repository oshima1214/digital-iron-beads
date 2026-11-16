import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { BRUSH_MAX, BRUSH_MIN, type BrushTool, settingsStore, useSettings } from '@/state/settings';

import { colors, fonts } from '../theme';

/** ペン・消しゴムの太さ（1〜7マス）を選ぶスライダー。道具ごとに別々に覚える。 */
export function BrushBar({ tool }: { tool: BrushTool }) {
  const size = useSettings((s) => (tool === 'pen' ? s.settings.penSize : s.settings.eraserSize));
  return (
    <View style={styles.bar}>
      <Text style={styles.label} numberOfLines={1}>
        {tool === 'pen' ? 'ペンの太さ' : '消しゴムの太さ'}
      </Text>
      <Slider
        testID="brush-size"
        accessibilityLabel={tool === 'pen' ? 'ペンの太さ' : '消しゴムの太さ'}
        style={styles.slider}
        minimumValue={BRUSH_MIN}
        maximumValue={BRUSH_MAX}
        step={1}
        value={size}
        minimumTrackTintColor={colors.accent}
        onValueChange={(v) => {
          if (Math.round(v) !== size) void settingsStore().getState().setBrushSize(tool, v);
        }}
      />
      <Text style={styles.value} testID="brush-size-value">
        {size}マス
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, flexShrink: 0 },
  slider: { flex: 1, minWidth: 0, height: 40 },
  value: { width: 44, textAlign: 'right', fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
});
