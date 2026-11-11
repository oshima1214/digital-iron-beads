import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { beadByIndex } from '@/core/palette/perler32';
import { editorStore } from '@/state/editor';
import { navStore, useNav } from '@/state/nav';
import { Button } from '@/ui/Button';
import { OpenError } from '@/ui/OpenError';
import { PlateMiniMap } from '@/ui/PlateMiniMap';
import { type PlateFit, PlateStage } from '@/ui/PlateStage';
import { Segmented } from '@/ui/Segmented';
import { colors, fonts } from '@/ui/theme';
import { useDeviceLayout } from '@/ui/useDeviceLayout';

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
    await navStore().getState().close();
    await editorStore().getState().open(id); // ナビで変わった進み具合を編集側にも読み込み直す（古い値で上書きしないように）
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/project/[id]', params: { id } });
  };

  const ready = project?.id === id;
  const current = order[colorIndex];
  const plate = plates[plateIndex];
  const last = plateIndex >= plates.length - 1;

  const panel = ready && (
    <View style={[styles.panel, dev.isPad && dev.landscape && styles.sidePanel]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" testID="nav-back" onPress={() => void backToEditor()} hitSlop={8} style={styles.hit}>
          <Text style={styles.link}>‹ 編集</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1} testID="nav-title">
          {project.name}
          {plates.length > 1 ? ` ・ プレート ${plateIndex + 1}/${plates.length}` : ''}
        </Text>
        <Pressable accessibilityRole="button" testID="nav-mirror" onPress={() => st().toggleMirror()} hitSlop={8} style={styles.hit}>
          <Text style={styles.link}>{mirror ? '⇋ 反転中' : '⇋ 反転'}</Text>
        </Pressable>
      </View>
      {dev.needsCalibration && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.banner}>
          <Text style={styles.bannerText}>実物のプレートに合わせて大きさを調整してください ›</Text>
        </Pressable>
      )}
      {order.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.big} testID="nav-current">
            このプレートにはビーズがありません
          </Text>
          {!last && <Button title="次のプレートへ" onPress={() => st().setPlate(plateIndex + 1)} />}
        </View>
      ) : done ? (
        <View style={styles.center}>
          <Text style={styles.big} testID="nav-current">
            {last ? 'すべて完成！アイロンをかけましょう' : 'このプレートは完成！'}
          </Text>
          <View style={styles.row}>
            <Button title="◀ 前へ" variant="secondary" onPress={() => st().prev()} testID="nav-prev" style={{ flex: 1 }} />
            {!last && <Button title="次のプレートへ" onPress={() => st().setPlate(plateIndex + 1)} testID="nav-next-plate" style={{ flex: 1 }} />}
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
                <Text style={styles.big} testID="nav-current" numberOfLines={1}>
                  <Text style={{ color: rgb(current.index) }}>●</Text> {beadByIndex(current.index).code} {beadByIndex(current.index).name} ・ {current.count}粒
                </Text>
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
                  {beadByIndex(item.index).code} {item.count}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}
      <View style={styles.row}>
        {plates.length > 1 && <PlateMiniMap sheet={project.sheet} plates={plates} current={plateIndex} size={dev.isPad ? 160 : 96} onSelect={(i) => st().setPlate(i)} />}
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

  const stage = ready && plate && (
    // iPad ではプレートを重ねるので、シート領域はタッチを受けない
    <View style={styles.stage} pointerEvents={dev.isPad ? 'none' : 'auto'} testID="nav-stage">
      <PlateStage sheet={project.sheet} plate={plate} focus={done ? undefined : current?.index} mirror={mirror} half={half} onFit={setFit} />
    </View>
  );

  const side = dev.isPad && dev.landscape;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {error ? (
        <OpenError />
      ) : !ready ? (
        <ActivityIndicator style={{ flex: 1 }} />
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
  sidePanel: { width: 360, marginBottom: 0, marginVertical: 8 },
  top: { height: 44, flexDirection: 'row', alignItems: 'center' },
  hit: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 16, color: colors.accent },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  banner: { backgroundColor: '#FFF4E5', borderRadius: 8, padding: 8 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, color: '#8A5300' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 92 },
  now: { flex: 1, alignItems: 'center' },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
  big: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  chips: { maxHeight: 44, flexGrow: 0 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.bg },
  chipOn: { backgroundColor: '#E5F0FF' },
  chipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  stage: { flex: 1, marginBottom: 8 },
});
