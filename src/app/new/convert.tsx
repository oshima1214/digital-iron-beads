import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recommendBeads } from '@/core/convert/convert';
import type { ConvertSettings } from '@/core/convert/types';
import { beadByIndex, PALETTE } from '@/core/palette/perler';
import type { BeadSet } from '@/core/palette/types';
import { countBeads } from '@/core/sheet/counts';
import type { SheetSize } from '@/core/sheet/sheet';
import { beadsNeeded, draftStore, useDraft } from '@/state/draft';
import { settingsStore, useSettings } from '@/state/settings';
import { useDraftFor } from '@/state/useDraftFor';
import { BeadOnePicker } from '@/ui/BeadPicker';
import { BeadSetPanel } from '@/ui/beads/BeadSetPanel';
import { ConvertPreviewCanvas } from '@/ui/ConvertPreviewCanvas';
import { LabeledSlider } from '@/ui/LabeledSlider';
import { notify, showMenu } from '@/ui/dialogs';
import { NavBar } from '@/ui/NavBar';
import { OpenError } from '@/ui/OpenError';
import { Segmented } from '@/ui/Segmented';
import { RowValue, SettingRow } from '@/ui/SettingRow';
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
const idx = (code: string) => PALETTE.find((b) => b.code === code)!.index;
/** 「使うビーズ」の切り替え。8色と手持ちは「…」のパネルで選ぶ */
const MAIN_SETS: readonly { value: BeadSet; label: string }[] = [
  { value: 'original', label: '元の色' },
  { value: '16', label: '16色' },
  { value: '32', label: '32色' },
];
const DEFAULT_TWO = { dark: idx('5018'), light: idx('5003'), threshold: 0.5 };

export default function Convert() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useDraftFor(id);
  const ready = status === 'ready';
  const settings = useDraft((s) => s.project?.source?.convert);
  const preview = useDraft((s) => s.preview);
  const busy = useDraft((s) => s.busy);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [converting, setConverting] = useState(false);
  const [picker, setPicker] = useState<null | 'dark' | 'light'>(null);
  // 「…」で開く使うビーズのパネル（開いている間は、設定の欄の代わりに出す）
  const [beadPanel, setBeadPanel] = useState(false);
  const [recommended, setRecommended] = useState<number[] | null>(null);
  const owned = useSettings((s) => s.settings.ownedBeads);
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

  const chooseSet = (beadSet: BeadSet, quality: 'fast' | 'full' = 'full', list: readonly number[] = owned) => {
    draftStore().getState().setBeadSet(beadSet, list);
    run(quality);
  };
  const changeOwned = (list: number[]) => {
    void settingsStore().getState().setOwnedBeads(list);
    chooseSet('owned', 'fast', list);
  };
  const openBeadPanel = () => {
    setBeadPanel(true);
    setRecommended(null);
    // この画像に合う色（64色で変換したときに使われる色）。重いので画面を出してから計算する
    setTimeout(() => {
      const st = draftStore().getState();
      const img = st.processed();
      const s = st.project?.source?.convert;
      if (img && s) setRecommended(recommendBeads(img, s));
    }, 0);
  };
  const closeBeadPanel = () => {
    setBeadPanel(false);
    run('full');
  };

  const done = async () => {
    const s = draftStore().getState().project?.source?.convert;
    if (s && beadsNeeded(s) !== 'ready') {
      // 元の色（または手持ちが0色）のままでは作品にできない：どのビーズで作るかを聞く
      const options: { label: string; set: BeadSet }[] = [
        { label: '16色', set: '16' },
        { label: '32色', set: '32' },
        { label: '8色', set: '8' },
        ...(owned.length > 0 ? [{ label: `手持ち（${owned.length}色）`, set: 'owned' as const }] : []),
      ];
      const i = await showMenu('どのビーズで作りますか？', options.map((o) => o.label));
      if (i === null) return;
      draftStore().getState().setBeadSet(options[i].set, owned);
    }
    try {
      const pid = await draftStore().getState().finish();
      router.replace({ pathname: '/project/[id]', params: { id: pid } });
    } catch (e) {
      console.warn(e);
      notify('保存できませんでした', '端末の空き容量を確認して、もう一度「完了」を押してください。');
    }
  };

  const counts = preview?.kind === 'beads' ? countBeads(preview.sheet) : [];
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
        {status === 'error' ? (
          <OpenError />
        ) : preview && box.w > 0 ? (
          <ConvertPreviewCanvas testID="convert-preview" preview={preview} width={box.w} height={box.h} />
        ) : (
          <ActivityIndicator />
        )}
        {(converting || busy) && <ActivityIndicator style={styles.spinner} />}
      </View>
      <Text style={styles.stats} testID="convert-stats">
        {preview?.kind === 'beads'
          ? `使用 ${counts.length}色 ・ ${total}粒`
          : preview?.kind === 'original'
            ? '元の色で表示中（ビーズの色ではありません）'
            : ' '}
      </Text>
      {settings && beadPanel && (
        <BeadSetPanel
          beadSet={settings.beadSet}
          owned={owned}
          recommended={recommended}
          onSet={(v) => chooseSet(v)}
          onOwned={changeOwned}
          onClose={closeBeadPanel}
        />
      )}
      {settings && !beadPanel && (
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
              <SettingRow label="使うビーズ">
                <View style={styles.beadRow}>
                  <Segmented<BeadSet> testID="bead-main" options={MAIN_SETS} value={settings.beadSet} onChange={(v) => chooseSet(v)} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="ほかのビーズ（8色・16色・32色・手持ち）"
                    testID="beads-more"
                    onPress={openBeadPanel}
                    style={[styles.more, (settings.beadSet === '8' || settings.beadSet === 'owned') && styles.moreOn]}>
                    <Text style={styles.moreText}>{settings.beadSet === '8' ? '8色 …' : settings.beadSet === 'owned' ? `手持ち${settings.allowedBeads.length} …` : '…'}</Text>
                  </Pressable>
                </View>
              </SettingRow>
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
  beadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { minHeight: 32, minWidth: 40, paddingHorizontal: 8, borderRadius: 7, backgroundColor: colors.separator, alignItems: 'center', justifyContent: 'center' },
  moreOn: { backgroundColor: colors.accent },
  moreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  sliderRow: { paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
});
