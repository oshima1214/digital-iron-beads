import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countBeads } from '@/core/sheet/counts';
import { platesOf } from '@/core/sheet/plates';
import { editorStore, useEditor } from '@/state/editor';
import { showMenu } from '@/ui/dialogs';
import { CountsSheet } from '@/ui/editor/CountsSheet';
import { EditorCanvas } from '@/ui/editor/EditorCanvas';
import { PaletteBar } from '@/ui/editor/PaletteBar';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/editor/SelectionBar';
import { Toolbar } from '@/ui/editor/Toolbar';
import { OpenError } from '@/ui/OpenError';
import { PlateMiniMap } from '@/ui/PlateMiniMap';
import { Segmented } from '@/ui/Segmented';
import { useDeviceLayout } from '@/ui/useDeviceLayout';
import { colors, fonts } from '@/ui/theme';

const HINTS = {
  pen: 'なぞって塗る',
  eraser: 'なぞって消す',
  bucket: 'タップしたところとつながった同じ色をまとめて塗る',
  select: '',
} as const;

/** ④ 編集画面 */
export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useEditor((s) => s.project);
  const error = useEditor((s) => s.error);
  const committed = useEditor((s) => s.committed);
  const tool = useEditor((s) => s.tool);
  const mirror = useEditor((s) => s.mirror);
  const melted = useEditor((s) => s.melted);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [showCounts, setShowCounts] = useState(false);
  const dev = useDeviceLayout();
  const [plateIndex, setPlateIndex] = useState(0);
  const [half, setHalf] = useState<0 | 1>(0);
  const [fit, setFit] = useState<{ fits: 'full' | 'half' | 'none'; rows: number } | null>(null);

  useEffect(() => {
    if (id && editorStore().getState().project?.id !== id) void editorStore().getState().open(id);
  }, [id]);

  const counts = useMemo(
    () => (project ? countBeads(project.sheet) : []),
    // committed は編集の確定を知らせるため（ストロークの途中では再計算しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, committed],
  );
  const total = counts.reduce((a, c) => a + c.count, 0);
  const st = () => editorStore().getState();

  const viewMenu = async () => {
    const i = await showMenu('表示', [`左右反転 ${mirror ? 'オフ' : 'オン'}`, `完成イメージ ${melted ? 'オフ' : 'オン'}`, '必要なビーズ']);
    if (i === 0) st().toggleMirror();
    else if (i === 1) st().toggleMelted();
    else if (i === 2) setShowCounts(true);
  };

  const ready = project?.id === id;
  const plates = ready ? platesOf(project.sheet) : [];
  const plate = dev.isPad && plates.length > 0 ? plates[Math.min(plateIndex, plates.length - 1)] : null;

  // iPad：縦向きはパネルが上・シートが下、横向きはシートとパネルを左右に並べる（仕様書 §6.2）。iPhone はパネルが下。
  const side = dev.isPad && dev.landscape;

  const toNav = async () => {
    await editorStore().getState().flush(); // 編集を保存してからナビへ
    router.push({ pathname: '/nav/[id]', params: { id } });
  };

  const topBar = (
    <View style={styles.top}>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} hitSlop={8} style={styles.hit}>
        <Text style={styles.link}>‹ ホーム</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {ready ? project.name : ''}
      </Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="元に戻す" testID="undo" disabled={!canUndo} onPress={() => st().undo()} hitSlop={6} style={styles.hit}>
          <Text style={[styles.icon, !canUndo && styles.off]}>↶</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="やり直す" testID="redo" disabled={!canRedo} onPress={() => st().redo()} hitSlop={6} style={styles.hit}>
          <Text style={[styles.icon, !canRedo && styles.off]}>↷</Text>
        </Pressable>
        <Pressable accessibilityRole="button" testID="view-menu" onPress={() => void viewMenu()} hitSlop={6} style={styles.hit}>
          <Text style={styles.link}>表示</Text>
        </Pressable>
        <Pressable accessibilityRole="button" testID="to-nav" disabled={!ready} onPress={() => void toNav()} hitSlop={6} style={styles.hit}>
          <Text style={styles.link}>ナビ</Text>
        </Pressable>
      </View>
    </View>
  );
  const stats = (
    <Text style={styles.stats} testID="editor-stats">
      {ready ? `${counts.length}色 ・ ${total}粒${mirror ? ' ・ 反転中' : ''}${melted ? ' ・ 完成イメージ' : ''}${plate && plates.length > 1 ? ` ・ プレート ${plate.index + 1}/${plates.length}` : ''}` : ' '}
    </Text>
  );
  const tools = (
    <View style={[styles.panel, side && styles.sidePanel]}>
      {/* 選択バーの場所は常に確保する（ツールを切り替えてもシートが動かないように） */}
      <View style={{ height: SELECTION_BAR_HEIGHT, justifyContent: 'center' }}>
        {tool === 'select' && !melted ? <SelectionBar /> : <Text style={styles.hint}>{melted ? '完成イメージを表示中（見るだけ）' : HINTS[tool]}</Text>}
      </View>
      <PaletteBar />
      <Toolbar disabled={melted || !ready} />
      {plate && (plates.length > 1 || fit?.fits === 'half') && (
        <View style={styles.plateRow}>
          {plates.length > 1 && ready && <PlateMiniMap sheet={project.sheet} plates={plates} current={plate.index} size={side ? 160 : 112} onSelect={setPlateIndex} />}
          {fit?.fits === 'half' && (
            <Segmented<0 | 1>
              options={[
                { value: 0, label: '上半分' },
                { value: 1, label: '下半分' },
              ]}
              value={half}
              onChange={setHalf}
            />
          )}
        </View>
      )}
    </View>
  );
  const canvas = (
    <View style={styles.canvas}>
      {error ? (
        <OpenError />
      ) : ready ? (
        <EditorCanvas plate={plate} physicalCell={dev.physicalCell} half={half} onFit={setFit} />
      ) : (
        <ActivityIndicator style={{ flex: 1 }} />
      )}
    </View>
  );
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {topBar}
      {stats}
      {side ? (
        <View style={styles.sideBySide}>
          {dev.panelSide === 'left' && tools}
          {canvas}
          {dev.panelSide === 'right' && tools}
        </View>
      ) : dev.isPad ? (
        <>
          {tools}
          {canvas}
        </>
      ) : (
        <>
          {canvas}
          {tools}
        </>
      )}
      <CountsSheet visible={showCounts} counts={counts} onClose={() => setShowCounts(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 12 },
  top: { height: 48, flexDirection: 'row', alignItems: 'center' },
  hit: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 17, color: colors.accent },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, color: colors.accent },
  off: { opacity: 0.3 },
  stats: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, marginBottom: 4 },
  canvas: { flex: 1, backgroundColor: colors.panel, borderRadius: 12, overflow: 'hidden' },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, paddingHorizontal: 6 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, paddingHorizontal: 6, marginVertical: 8 },
  sidePanel: { width: 360, marginVertical: 0 },
  sideBySide: { flex: 1, flexDirection: 'row', gap: 12, marginBottom: 8 },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
