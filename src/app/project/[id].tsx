import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countBeads } from '@/core/sheet/counts';
import { editorStore, useEditor } from '@/state/editor';
import { showMenu } from '@/ui/dialogs';
import { CountsSheet } from '@/ui/editor/CountsSheet';
import { EditorCanvas } from '@/ui/editor/EditorCanvas';
import { PaletteBar } from '@/ui/editor/PaletteBar';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/editor/SelectionBar';
import { Toolbar } from '@/ui/editor/Toolbar';
import { OpenError } from '@/ui/OpenError';
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
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
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
        </View>
      </View>
      <Text style={styles.stats} testID="editor-stats">
        {ready ? `${counts.length}色 ・ ${total}粒${mirror ? ' ・ 反転中' : ''}${melted ? ' ・ 完成イメージ' : ''}` : ' '}
      </Text>
      <View style={styles.canvas}>{error ? <OpenError /> : ready ? <EditorCanvas /> : <ActivityIndicator style={{ flex: 1 }} />}</View>
      <View style={styles.panel}>
        {/* 選択バーの場所は常に確保する（ツールを切り替えてもシートが動かないように） */}
        <View style={{ height: SELECTION_BAR_HEIGHT, justifyContent: 'center' }}>
          {tool === 'select' && !melted ? <SelectionBar /> : <Text style={styles.hint}>{melted ? '完成イメージを表示中（見るだけ）' : HINTS[tool]}</Text>}
        </View>
        <PaletteBar />
        <Toolbar disabled={melted || !ready} />
      </View>
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
});
