import Slider from '@react-native-community/slider';
import { Canvas, Circle, Line, Rect, vec } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cellPt, PLATE_CELLS } from '@/core/physical';
import { CALIBRATION_MAX, CALIBRATION_MIN, settingsStore, useSettings } from '@/state/settings';
import { Button } from '@/ui/Button';
import { NavBar } from '@/ui/NavBar';
import { Segmented } from '@/ui/Segmented';
import { colors, fonts } from '@/ui/theme';
import { density, useDeviceLayout } from '@/ui/useDeviceLayout';

const STEP = 0.002;

/** 実寸の 100mm の定規（10mm ごとの目盛り）。 */
function Ruler({ mmPt }: { mmPt: number }) {
  const w = mmPt * 100;
  return (
    <Canvas style={{ width: w + 2, height: 36 }}>
      <Line p1={vec(1, 30)} p2={vec(w + 1, 30)} color={colors.text} strokeWidth={1.5} />
      {Array.from({ length: 101 }, (_, i) => (
        <Line key={i} p1={vec(1 + i * mmPt, 30)} p2={vec(1 + i * mmPt, i % 10 === 0 ? 8 : i % 5 === 0 ? 16 : 22)} color={colors.text} strokeWidth={i % 10 === 0 ? 1.5 : 0.75} />
      ))}
    </Canvas>
  );
}

export default function Settings() {
  const dev = useDeviceLayout();
  const s = useSettings((x) => x.settings);
  const st = () => settingsStore().getState();
  const cell = cellPt(density.ptPerInch, s.calibration);
  const mmPt = cell / 5;
  const plate = cell * PLATE_CELLS;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar title="設定" left={{ title: '‹ 戻る', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }} />
      <View style={styles.section}>
        <Text style={styles.heading}>実寸の調整（iPad）</Text>
        {dev.isPad ? (
          <>
            <Text style={styles.note}>定規を当てるか、実物のプレートを枠に重ねて、ぴったり合うように調整してください。</Text>
            <Ruler mmPt={mmPt} />
            <Text style={styles.small}>↑ 100mm</Text>
            <View style={styles.row}>
              <Button title="−" variant="secondary" onPress={() => void st().setCalibration(s.calibration - STEP)} testID="cal-minus" style={styles.pm} />
              <Slider
                style={{ flex: 1 }}
                minimumValue={CALIBRATION_MIN}
                maximumValue={CALIBRATION_MAX}
                step={STEP}
                value={s.calibration}
                minimumTrackTintColor={colors.accent}
                onSlidingComplete={(v) => void st().setCalibration(v)}
              />
              <Button title="＋" variant="secondary" onPress={() => void st().setCalibration(s.calibration + STEP)} testID="cal-plus" style={styles.pm} />
            </View>
            <Text style={styles.small} testID="cal-value">
              補正 {s.calibration.toFixed(3)} ・ プレート 145mm ＝ {plate.toFixed(1)}pt
            </Text>
            <Button title="元に戻す" variant="plain" onPress={() => void st().reset()} />
            <Text style={styles.note}>プレートの端の1列を、下の点に重ねてください（29個・5mm 間隔）</Text>
            <Canvas style={{ width: plate + 2, height: cell + 2 }} testID="cal-plate-row">
              <Rect x={1} y={1} width={plate} height={cell} color={colors.separator} style="stroke" strokeWidth={1} />
              {Array.from({ length: PLATE_CELLS }, (_, i) => (
                <Circle key={i} cx={1 + (i + 0.5) * cell} cy={1 + cell / 2} r={cell * 0.18} color={colors.accent} />
              ))}
            </Canvas>
          </>
        ) : (
          <Text style={styles.note}>iPad でのみ使います（iPhone は実寸表示をしません）。</Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>パネルの位置（iPad 横向き）</Text>
        <Segmented<'left' | 'right'>
          testID="panel-side"
          options={[
            { value: 'left', label: '左' },
            { value: 'right', label: '右' },
          ]}
          value={s.panelSide}
          onChange={(v) => void st().setPanelSide(v)}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>クレジット</Text>
        <Text style={styles.small}>原案：日本海情報ビジネス専門学校（NiB）</Text>
        <Text style={styles.small}>フォント：BIZ UDPゴシック（SIL Open Font License 1.1）</Text>
        <Text style={styles.small}>色番号はパーラー対応色番号です。各商標は各社に帰属します。</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  section: { backgroundColor: colors.panel, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12, overflow: 'hidden' },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtext },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pm: { width: 56 },
});
