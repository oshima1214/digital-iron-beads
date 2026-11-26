import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Project } from '@/core/file/project';
import { countBeads } from '@/core/sheet/counts';
import { mirrorPlateIndex, platesOf } from '@/core/sheet/plates';
import { editorStore, useEditor } from '@/state/editor';
import { confirmDestructive, showMenu } from '@/ui/dialogs';
import { draftStore } from '@/state/draft';
import { CountsSheet } from '@/ui/editor/CountsSheet';
import { EditorCanvas } from '@/ui/editor/EditorCanvas';
import { loadStatus } from '@/core/machines/loadStatus';
import { editorMode } from '@/core/machines/phases';
import { type PhonePhysical, PHONE_PHYSICAL_SIZE } from '@/core/physical';
import { NavButton } from '@/ui/NavButton';
import { BrushBar } from '@/ui/editor/BrushBar';
import { PaletteBar } from '@/ui/editor/PaletteBar';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/editor/SelectionBar';
import { Toolbar } from '@/ui/editor/Toolbar';
import { OpenError } from '@/ui/OpenError';
import { PlateMiniMap } from '@/ui/PlateMiniMap';
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
  const rangePhase = useEditor((s) => s.rangePhase);
  const notice = useEditor((s) => s.notice);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [showCounts, setShowCounts] = useState(false);
  const dev = useDeviceLayout();
  const [plateIndex, setPlateIndex] = useState(0);


  useEffect(() => {
    if (id) void editorStore().getState().ensureOpen(id);
  }, [id]);

  const counts = useMemo(
    () => (project ? countBeads(project.sheet) : []),
    // committed は編集の確定を知らせるため（ストロークの途中では再計算しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, committed],
  );
  const total = counts.reduce((a, c) => a + c.count, 0);
  const st = () => editorStore().getState();

  // 元の写真がある作品（写真から作った・写真入りの .beads を読み込んだ）は、ビーズシート作成に戻って作り直せる
  const canRemake = !!project?.source;
  const viewMenu = async () => {
    const items = [`左右反転 ${mirror ? 'オフ' : 'オン'}`, `完成イメージ ${melted ? 'オフ' : 'オン'}`, '必要なビーズ', '書き出し・共有'];
    const i = await showMenu('メニュー', canRemake ? [...items, 'ビーズシートを作り直す'] : items);
    if (i === 0) st().toggleMirror();
    else if (i === 1) st().toggleMelted();
    else if (i === 2) setShowCounts(true);
    else if (i === 3) {
      await st().flush(); // 最新の編集を保存してから書き出す
      router.push({ pathname: '/export/[id]', params: { id } });
    } else if (i === 4) {
      const ok = await confirmDestructive(
        'ビーズシートを作り直しますか？',
        'サイズや使うビーズを変えて作り直せます。作り直すと、編集で直したところは消えます（作り直さずに戻れば、今のままです）。',
        '作り直す',
      );
      if (!ok) return;
      await st().flush();
      // 作成画面は、前に作ったときの作品を覚えていることがある（名前などが古い）。保存したものを読み直してから開く
      await draftStore().getState().open(id);
      router.push({ pathname: '/new/convert', params: { id } });
    }
  };

  const status = loadStatus({ wanted: id, loaded: project?.id, error: !!error });
  const ready = project?.id === id;
  // ホームに戻るとき、ホームが作品を閉じる（project が null になる）のは、この画面が横に消えていく途中。
  // そのあいだは最後に表示していた作品をそのまま見せる（読み込み中の表示に変えない）
  const focused = useIsFocused();
  const [last, setLast] = useState<Project | null>(null);
  if (ready && last !== project) setLast(project);
  const leaving = !focused && !ready && last?.id === id;
  const view = ready ? project : leaving ? last : null;
  // iPhone：13×13 の作品は実寸で描く（入らない機種は注意書き）。実寸のあいだはシートの箱を画面の端まで広げる
  const phoneOn = !dev.isPad && !!dev.phoneCell && view?.sheet.width === PHONE_PHYSICAL_SIZE && view?.sheet.height === PHONE_PHYSICAL_SIZE;
  const [phonePhysical, setPhonePhysical] = useState<PhonePhysical>('off');
  const mode = editorMode(tool, melted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plates = useMemo(() => (view ? platesOf(view.sheet) : []), [view?.id, view?.sheet.width]);
  const plate = dev.isPad && plates.length > 0 ? plates[Math.min(plateIndex, plates.length - 1)] : null;

  // iPad：縦向きはパネルが上・シートが下、横向きはシートとパネルを左右に並べる（仕様書 §6.2）。iPhone はパネルが下。
  const side = dev.isPad && dev.landscape;

  const toNav = async () => {
    await editorStore().getState().flush(); // 編集を保存してからナビへ
    router.push({ pathname: '/nav/[id]', params: { id } });
  };

  // 上の帯：大きなボタンを並べる。作品名は下の行に出す（ボタンを大きくしたので、ここには入らない）
  const topBar = (
    <View style={styles.top}>
      <NavButton title="‹ ホーム" onPress={() => router.dismissTo('/')} testID="to-home" />
      <View style={{ flex: 1 }} />
      <NavButton title="↶" accessibilityLabel="元に戻す" testID="undo" disabled={!canUndo} onPress={() => st().undo()} />
      <NavButton title="↷" accessibilityLabel="やり直す" testID="redo" disabled={!canRedo} onPress={() => st().redo()} />
      <NavButton title="メニュー" testID="view-menu" onPress={() => void viewMenu()} />
      <NavButton title="ナビ" testID="to-nav" disabled={!ready} onPress={() => void toNav()} primary />
    </View>
  );
  const stats = (
    <Text style={styles.stats} numberOfLines={1}>
      <Text style={styles.name}>{ready ? project.name : ''}</Text>
      {ready ? '  ' : ''}
      <Text testID="editor-stats">
      {ready ? `${counts.length}色 ・ ${total}ビーズ${mirror ? ' ・ 反転中' : ''}${melted ? ' ・ 完成イメージ' : ''}${mode === 'select' && rangePhase === 'anchored' ? ' ・ 範囲：もう一方の角をタップ' : ''}${plate && plates.length > 1 ? ` ・ プレート ${(mirror ? mirrorPlateIndex(plates, plate.index) : plate.index) + 1}/${plates.length}` : ''}` : ' '}
      </Text>
    </Text>
  );
  const phoneNotice = phoneOn && phonePhysical === 'too-small' && (
    <Text style={styles.phoneNotice} testID="phone-physical-notice">
      この iPhone は画面が小さいため、実寸では表示できません
    </Text>
  );
  const tools = (
    <View style={[styles.panel, side && styles.sidePanel]}>
      {/* 選択バーの場所は常に確保する（ツールを切り替えてもシートが動かないように） */}
      <View style={{ height: SELECTION_BAR_HEIGHT, justifyContent: 'center' }}>
        {mode === 'viewing' ? (
          <Text style={styles.hint}>完成イメージを表示中（見るだけ）</Text>
        ) : mode === 'select' ? (
          <SelectionBar />
        ) : mode === 'brush' ? (
          <BrushBar tool={tool === 'eraser' ? 'eraser' : 'pen'} />
        ) : notice === 'same-color' ? (
          <Text style={[styles.hint, styles.notice]} testID="editor-notice">
            もう同じ色です。下で別の色を選んでからタップしてください
          </Text>
        ) : (
          <Text style={styles.hint}>{HINTS[tool]}</Text>
        )}
      </View>
      <PaletteBar />
      <Toolbar disabled={mode === 'viewing' || !ready} />
      {plate && plates.length > 1 && ready && (
        <View style={styles.plateRow}>
          <PlateMiniMap sheet={project.sheet} plates={plates} current={plate.index} size={side ? 160 : 112} mirror={mirror} onSelect={setPlateIndex} />
        </View>
      )}
    </View>
  );
  const canvas = (
    <View style={[styles.canvas, phoneOn && styles.canvasEdge]}>
      {status === 'error' ? (
        <OpenError />
      ) : view ? (
        <EditorCanvas
          project={view}
          plate={plate}
          physicalCell={dev.physicalCell}
          phoneCell={phoneOn ? dev.phoneCell : null}
          onPhonePhysical={setPhonePhysical}
          readOnly={!ready}
        />
      ) : (
        <ActivityIndicator style={{ flex: 1 }} />
      )}
    </View>
  );
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {topBar}
      {stats}
      {phoneNotice}
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
  top: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  stats: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, marginBottom: 4 },
  canvas: { flex: 1, backgroundColor: colors.panel, borderRadius: 12, overflow: 'hidden' },
  // 画面の左右の余白（root の paddingHorizontal）を打ち消す。iPhone 15 などは余白があると 13マスが実寸で入らない
  canvasEdge: { marginHorizontal: -12, borderRadius: 0 },
  phoneNotice: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, marginBottom: 4 },
  notice: { color: colors.text, fontFamily: fonts.bold },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, paddingHorizontal: 6 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, paddingHorizontal: 6, marginVertical: 8 },
  sidePanel: { width: 360, marginVertical: 0 },
  sideBySide: { flex: 1, flexDirection: 'row', gap: 12, marginBottom: 8 },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
