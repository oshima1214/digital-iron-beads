import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ConvertSettings } from '@/core/convert/types';
import { beadByIndex, PERLER32 } from '@/core/palette/perler32';
import { countBeads } from '@/core/sheet/counts';
import type { SheetSize } from '@/core/sheet/sheet';
import { draftStore, useDraft } from '@/state/draft';
import { useDraftFor } from '@/state/useDraftFor';
import { BeadOnePicker, BeadSetPicker, beadSetLabel } from '@/ui/BeadPicker';
import { LabeledSlider } from '@/ui/LabeledSlider';
import { NavBar } from '@/ui/NavBar';
import { Segmented } from '@/ui/Segmented';
import { RowValue, SettingRow } from '@/ui/SettingRow';
import { SheetCanvas } from '@/ui/SheetCanvas';
import { colors, fonts } from '@/ui/theme';

const SIZES: readonly { value: SheetSize; label: string }[] = [13, 21, 29, 58, 116].map((v) => ({ value: v as SheetSize, label: String(v) }));
const PRESETS = [
  { value: 'illust', label: 'イラスト' },
  { value: 'photo', label: '写真' },
  { value: 'twoColor', label: '2色' },
] as const;
const NOISE = [
  { value: 0, label: 'なし' },
  { value: 1, label: '弱' },
  { value: 2, label: '強' },
] as const;
const idx = (code: string) => PERLER32.find((b) => b.code === code)!.index;
const DEFAULT_TWO = { dark: idx('5018'), light: idx('5003'), threshold: 0.5 };

export default function Convert() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useDraftFor(id);
  const settings = useDraft((s) => s.project?.source?.convert);
  const preview = useDraft((s) => s.preview);
  const busy = useDraft((s) => s.busy);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [converting, setConverting] = useState(false);
  const [picker, setPicker] = useState<null | 'set' | 'dark' | 'light'>(null);
  const [maxLocal, setMaxLocal] = useState<number | null>(null);
  const [thrLocal, setThrLocal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (quality: 'fast' | 'full') => {
    if (timer.current) clearTimeout(timer.current);
    setConverting(true);
    timer.current = setTimeout(() => {
      draftStore().getState().convertPreview(quality);
      setConverting(false);
    }, 0);
  };

  // 開いたとき（再開を含む）に一度だけ本番の解像度で変換する。
  useEffect(() => {
    if (!ready || draftStore().getState().preview) return;
    const t = setTimeout(() => run('full'), 0);
    return () => clearTimeout(t);
  }, [ready]);

  const set = (partial: Partial<ConvertSettings>, quality: 'fast' | 'full' = 'full') => {
    draftStore().getState().setSettings(partial);
    run(quality);
  };

  const done = async () => {
    const pid = await draftStore().getState().finish();
    router.replace({ pathname: '/project/[id]', params: { id: pid } });
  };

  const counts = preview ? countBeads(preview) : [];
  const total = counts.reduce((a, c) => a + c.count, 0);
  const two = settings?.twoColor ?? DEFAULT_TWO;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar
        title="ビーズにする"
        left={{ title: '‹ 戻る', onPress: () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/new/prepare', params: { id } })) }}
        right={{ title: '完了', testID: 'convert-done', disabled: !ready || busy || !preview, onPress: () => void done() }}
      />
      <View style={styles.preview} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {preview && box.w > 0 ? <SheetCanvas testID="convert-preview" sheet={preview} width={box.w} height={box.h} /> : <ActivityIndicator />}
        {(converting || busy) && <ActivityIndicator style={styles.spinner} />}
      </View>
      <Text style={styles.stats} testID="convert-stats">
        {preview ? `使用 ${counts.length}色 ・ ${total}粒` : ' '}
      </Text>
      {settings && (
        <View style={styles.panel}>
          <SettingRow label="サイズ">
            <Segmented testID="size" options={SIZES} value={settings.size} onChange={(v) => set({ size: v })} />
          </SettingRow>
          <SettingRow label="用途">
            <Segmented
              testID="preset"
              options={PRESETS}
              value={settings.preset}
              onChange={(v) => set(v === 'twoColor' && !settings.twoColor ? { preset: v, twoColor: DEFAULT_TWO } : { preset: v })}
            />
          </SettingRow>
          {settings.preset === 'twoColor' ? (
            <>
              <SettingRow label="暗い色" onPress={() => setPicker('dark')}>
                <RowValue text={`${beadByIndex(two.dark).code} ${beadByIndex(two.dark).name}`} />
              </SettingRow>
              <SettingRow label="明るい色" onPress={() => setPicker('light')}>
                <RowValue text={`${beadByIndex(two.light).code} ${beadByIndex(two.light).name}`} />
              </SettingRow>
              <View style={styles.sliderRow}>
                <LabeledSlider
                  label="しきい値"
                  value={thrLocal ?? two.threshold * 100}
                  min={0}
                  max={100}
                  onChange={(v) => {
                    setThrLocal(v);
                    set({ twoColor: { ...two, threshold: v / 100 } }, 'fast');
                  }}
                  onComplete={(v) => {
                    setThrLocal(null);
                    set({ twoColor: { ...two, threshold: v / 100 } });
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <SettingRow label="使うビーズ" onPress={() => setPicker('set')} testID="beads-row">
                <RowValue text={beadSetLabel(settings.allowedBeads)} />
              </SettingRow>
              <View style={styles.sliderRow}>
                <LabeledSlider
                  label="色数の上限"
                  testID="max-colors"
                  value={maxLocal ?? settings.maxColors}
                  min={2}
                  max={32}
                  onChange={(v) => {
                    setMaxLocal(v);
                    set({ maxColors: Math.round(v) }, 'fast');
                  }}
                  onComplete={(v) => {
                    setMaxLocal(null);
                    set({ maxColors: Math.round(v) });
                  }}
                />
              </View>
            </>
          )}
          <SettingRow label="ノイズ掃除">
            <Segmented options={NOISE} value={settings.noise} onChange={(v) => set({ noise: v })} />
          </SettingRow>
          {settings.preset === 'photo' && (
            <SettingRow label="ディザリング">
              <Switch value={settings.dither} onValueChange={(v) => set({ dither: v })} />
            </SettingRow>
          )}
          <SettingRow label="背景を自動で除く" last>
            <Switch testID="remove-bg" value={settings.removeBackground} onValueChange={(v) => set({ removeBackground: v })} />
          </SettingRow>
        </View>
      )}
      {settings && (
        <>
          <BeadSetPicker
            visible={picker === 'set'}
            value={settings.allowedBeads}
            onClose={(v) => {
              setPicker(null);
              set({ allowedBeads: v });
            }}
          />
          <BeadOnePicker
            visible={picker === 'dark' || picker === 'light'}
            title={picker === 'dark' ? '暗い色' : '明るい色'}
            value={picker === 'light' ? two.light : two.dark}
            onClose={(v) => {
              const which = picker;
              setPicker(null);
              set({ twoColor: { ...two, [which === 'light' ? 'light' : 'dark']: v } });
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  spinner: { position: 'absolute', top: 8, right: 8 },
  stats: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, marginVertical: 6 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  sliderRow: { paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
});
