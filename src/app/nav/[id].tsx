import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadStatus } from '@/core/machines/loadStatus';
import { navPhase } from '@/core/machines/phases';
import { beadByIndex } from '@/core/palette/perler';
import { mirrorPlateIndex } from '@/core/sheet/plates';
import { navStore, useNav } from '@/state/nav';
import { Button } from '@/ui/Button';
import { NavButton } from '@/ui/NavButton';
import { OpenError } from '@/ui/OpenError';
import { PlateMiniMap } from '@/ui/PlateMiniMap';
import { type PlateFit, PlateStage } from '@/ui/PlateStage';
import { Segmented } from '@/ui/Segmented';
import { colors, fonts } from '@/ui/theme';
import { SIDE_PANEL_W, useDeviceLayout } from '@/ui/useDeviceLayout';

const rgb = (i: number) => `rgb(${beadByIndex(i).rgb.join(',')})`;

/** ⑤ 制作ナビ */
export default function Nav() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dev = useDeviceLayout();
  const project = useNav((s) => s.project);
  const error = useNav((s) => s.error);
  const plates = useNav((s) => s.plates);
  const plateIndex = useNav((s) => s.plateIndex);
  const order = useNav((s) => s.order);
  const colorIndex = useNav((s) => s.colorIndex);
  const done = useNav((s) => s.done);
  const mirror = useNav((s) => s.mirror);
  const half = useNav((s) => s.half);
  const [fit, setFit] = useState<PlateFit | null>(null);
  const st = () => navStore().getState();

  useEffect(() => {
    void navStore().getState().open(id);
  }, [id]);

  const backToEditor = async () => {
    await navStore().getState().flush();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/project/[id]', params: { id } });
  };

  const status = loadStatus({ wanted: id, loaded: project?.id, error: !!error });
  // すべて置き終わったら：進み具合を保存してホームへ
  const goHome = async () => {
    await navStore().getState().flush();
    router.dismissTo('/');
  };

  const ready = project?.id === id;
  const phase = navPhase(order.length, done);
  // 反転中は見た目の位置で番号を数える（シート全体を反転）
  const visualIndex = mirror ? mirrorPlateIndex(plates, plateIndex) : plateIndex;
  const toData = (visual: number) => (mirror ? mirrorPlateIndex(plates, visual) : visual);
  const current = order[colorIndex];
  const plate = plates[plateIndex];
  const last = (mirror ? mirrorPlateIndex(plates, plateIndex) : plateIndex) >= plates.length - 1;

  const panel = ready && (
    <View style={[styles.panel, dev.isPad && dev.stage === 'side' && styles.sidePanel]}>
      <View style={styles.top}>
        <NavButton title="‹ 編集" testID="nav-back" onPress={() => void backToEditor()} />
        <Text style={styles.title} numberOfLines={1} testID="nav-title">
          {project.name}
          {plates.length > 1 ? ` ・ プレート ${visualIndex + 1}/${plates.length}` : ''}
        </Text>
        <NavButton title={mirror ? '⇋ 反転中' : '⇋ 反転'} testID="nav-mirror" onPress={() => st().toggleMirror()} />
      </View>
      {dev.needsCalibration && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.banner}>
          <Text style={styles.bannerText}>実物のプレートに合わせて大きさを調整してください ›</Text>
        </Pressable>
      )}
      {phase === 'empty' ? (
        <View style={styles.center}>
          <Text style={styles.big} testID="nav-current">
            このプレートにはビーズがありません
          </Text>
          {!last && <Button title="次のプレートへ" onPress={() => st().setPlate(toData(visualIndex + 1))} />}
        </View>
      ) : phase === 'done' ? (
        <View style={styles.center}>
          <Text style={styles.big} testID="nav-current">
            {last ? 'すべて完成！アイロンをかけましょう' : 'このプレートは完成！'}
          </Text>
          <View style={styles.row}>
            <Button title="◀ 前へ" variant="secondary" onPress={() => st().prev()} testID="nav-prev" style={{ flex: 1 }} />
            {last ? (
              <Button title="ホームへ" onPress={() => void goHome()} testID="nav-home" style={{ flex: 1 }} />
            ) : (
              <Button title="次のプレートへ" onPress={() => st().setPlate(toData(visualIndex + 1))} testID="nav-next-plate" style={{ flex: 1 }} />
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Button title="◀ 前へ" variant="secondary" onPress={() => st().prev()} disabled={colorIndex === 0} testID="nav-prev" style={styles.step} />
            <View style={styles.now}>
              <Text style={styles.small}>
                {colorIndex + 1} / {order.length} 色め
              </Text>
              {current && (
                // 色の名前を大きく1行で、品番と数はその下に小さく（長い名前でも切れないように）
                <View testID="nav-current">
                  <Text style={styles.big} numberOfLines={1}>
                    <Text style={{ color: rgb(current.index) }}>●</Text> {beadByIndex(current.index).name}
                  </Text>
                  <Text style={styles.small} numberOfLines={1}>
                    （{beadByIndex(current.index).code}） ・ {current.count}ビーズ
                  </Text>
                </View>
              )}
            </View>
            <Button title="次へ ▶" onPress={() => st().next()} testID="nav-next" style={styles.step} />
          </View>
          <FlatList
            horizontal
            style={styles.chips}
            data={order}
            keyExtractor={(c) => String(c.index)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityRole="button"
                testID={`nav-chip-${beadByIndex(item.index).code}`}
                onPress={() => st().jump(index)}
                style={[styles.chip, index === colorIndex && styles.chipOn]}>
                <Text style={{ color: rgb(item.index), fontSize: 14 }}>●</Text>
                <Text style={styles.chipText}>
                  {beadByIndex(item.index).name}
                  <Text style={styles.chipCode}>（{beadByIndex(item.index).code}）</Text> {item.count}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}
      <View style={styles.row}>
        {plates.length > 1 && <PlateMiniMap sheet={project.sheet} plates={plates} current={plateIndex} size={dev.isPad ? 160 : 96} mirror={mirror} onSelect={(i) => st().setPlate(i)} />}
        {fit?.fits === 'half' && (
          <Segmented<0 | 1>
            testID="nav-half"
            options={[
              { value: 0, label: '上半分' },
              { value: 1, label: '下半分' },
            ]}
            value={half}
            onChange={(v) => st().setHalf(v)}
          />
        )}
      </View>
    </View>
  );

  // iPad mini の横向きなど、横にパネルを置くとプレートが入らないとき：上に1行だけの薄いパネル
  const compactPanel = ready && (
    <View style={[styles.panel, styles.compact]}>
      <NavButton title="‹ 編集" testID="nav-back" onPress={() => void backToEditor()} />
      <Button title="◀" variant="secondary" onPress={() => st().prev()} testID="nav-prev" style={styles.mini} />
      <Text style={[styles.big, { flex: 1 }]} testID="nav-current" numberOfLines={1}>
        {phase === 'empty'
          ? 'ビーズなし'
          : phase === 'done'
            ? '完成！'
            : current && (
                <>
                  {colorIndex + 1}/{order.length} {beadByIndex(current.index).name}
                  <Text style={styles.code}>（{beadByIndex(current.index).code}）</Text> {current.count}ビーズ
                </>
              )}
      </Text>
      {phase === 'done' && last ? (
        <Button title="ホームへ" onPress={() => void goHome()} testID="nav-home" style={styles.mini} />
      ) : (
        <Button title="▶" onPress={() => st().next()} testID="nav-next" style={styles.mini} />
      )}
      {fit?.fits === 'half' && (
        <Segmented<0 | 1>
          testID="nav-half"
          options={[
            { value: 0, label: '上' },
            { value: 1, label: '下' },
          ]}
          value={half}
          onChange={(v) => st().setHalf(v)}
        />
      )}
      {plates.length > 1 && (
        <Button title={`プレート ${visualIndex + 1}/${plates.length} ▸`} variant="plain" onPress={() => st().setPlate(toData((visualIndex + 1) % plates.length))} testID="nav-title" />
      )}
      <NavButton title={mirror ? '⇋反転中' : '⇋'} accessibilityLabel="左右反転" testID="nav-mirror" onPress={() => st().toggleMirror()} />
    </View>
  );

  const stage = ready && plate && (
    // iPad ではプレートを重ねるので、シート領域はタッチを受けない
    <View style={styles.stage} pointerEvents={dev.isPad ? 'none' : 'auto'} testID="nav-stage">
      <PlateStage sheet={project.sheet} plate={plate} focus={phase === 'placing' ? current?.index : undefined} mirror={mirror} half={half} onFit={setFit} />
    </View>
  );

  const side = dev.isPad && dev.stage === 'side';
  const compact = dev.isPad && dev.stage === 'compact';
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {status === 'error' ? (
        <OpenError />
      ) : !ready ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : compact ? (
        <>
          {compactPanel}
          {stage}
        </>
      ) : side ? (
        <View style={styles.sideBySide}>
          {dev.panelSide === 'left' && panel}
          {stage}
          {dev.panelSide === 'right' && panel}
        </View>
      ) : (
        <>
          {panel}
          {stage}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 12 },
  sideBySide: { flex: 1, flexDirection: 'row', gap: 12 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, padding: 8, gap: 6, marginBottom: 8 },
  sidePanel: { width: SIDE_PANEL_W, marginBottom: 0, marginVertical: 8 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  mini: { width: 48 },
  top: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hit: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 16, color: colors.accent },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  banner: { backgroundColor: '#FFF4E5', borderRadius: 8, padding: 8 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, color: '#8A5300' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 84 },
  now: { flex: 1, alignItems: 'center' },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.subtext },
  big: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.text, textAlign: 'center' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  chips: { maxHeight: 44, flexGrow: 0 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.bg },
  chipOn: { backgroundColor: '#E5F0FF' },
  chipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  // 品番は色の名前のうしろに小さく（色の名前のほうをよく見るので）
  code: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
  chipCode: { fontFamily: fonts.regular, fontSize: 10, color: colors.subtext },
  stage: { flex: 1, marginBottom: 8 },
});
