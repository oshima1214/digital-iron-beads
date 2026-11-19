import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildPrintHtml } from '@/core/export/print';
import { base64ToBytes } from '@/core/file/base64';
import { bakeCrop, packBeads } from '@/core/file/beads';
import type { Project } from '@/core/file/project';
import { beadByIndex } from '@/core/palette/perler';
import { countBeads } from '@/core/sheet/counts';
import { printPdf, shareBeads, sharePdf, sharePng } from '@/platform/exporter';
import { encodePng, loadRgba } from '@/platform/pixels';
import { projectRepo } from '@/platform/projectRepo';
import { editorStore } from '@/state/editor';
import { projectsStore } from '@/state/projects';
import { Button } from '@/ui/Button';
import { notify } from '@/ui/dialogs';
import { NavBar } from '@/ui/NavBar';
import { OpenError } from '@/ui/OpenError';
import { colors, fonts } from '@/ui/theme';

/** 元画像のバイト列。読めなければ null。 */
async function readSource(p: Project): Promise<Uint8Array | null> {
  if (!p.source) return null;
  try {
    const uri = projectRepo.sourceUri(p.id, p.source.image);
    if (uri.startsWith('data:')) return base64ToBytes(uri.slice(uri.indexOf(',') + 1));
    const res = await fetch(uri);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** .beads の中身：切り抜いた後の画像だけを入れる（切り抜き枠は画像に焼き込む）。元画像が読めなければ図案だけ。 */
async function beadsBytes(p: Project): Promise<Uint8Array> {
  if (!p.source) return packBeads(p, null);
  const png = await readSource(p);
  if (!png) return packBeads(p, null);
  if (!p.source.crop) return packBeads(p, png);
  const img = await loadRgba(projectRepo.sourceUri(p.id, p.source.image));
  const baked = bakeCrop(p, img);
  return packBeads(baked.project, await encodePng(baked.image));
}

/** ⑥ 書き出し・共有 */
export default function Export() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // 読み込みの状態（loading → ready / error）。作品は ready のときだけある
  const [load, setLoad] = useState<{ status: 'loading' } | { status: 'ready'; project: Project } | { status: 'error' }>({ status: 'loading' });
  const loaded = load.status === 'ready' ? load.project : null;
  // 書き出すときの作品名（この画面で変えられる）。日本語入力を壊さないよう、入力欄は value で縛らない
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectRepo
      .load(id)
      .then((p) => setLoad({ status: 'ready', project: p }))
      .catch(() => setLoad({ status: 'error' }));
  }, [id]);

  const project = loaded ? { ...loaded, name: name?.trim() || loaded.name } : null;

  /** 作品名を保存する（編集画面が作品を持っていれば、そちらを通して保存。持っていなければ直接） */
  const saveName = async () => {
    const n = name?.trim();
    if (!loaded || !n || n === loaded.name) return;
    const ed = editorStore().getState();
    if (ed.project?.id === id) {
      ed.setName(n);
      await ed.flush();
    } else await projectsStore().getState().rename(id, n);
  };

  const run = async (f: (p: Project) => Promise<void>) => {
    if (!project) return;
    setBusy(true);
    try {
      await saveName();
      await f(project);
    } catch (e) {
      console.warn(e);
      notify('書き出せませんでした', 'もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  const counts = project ? countBeads(project.sheet) : [];
  const total = counts.reduce((a, c) => a + c.count, 0);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar
        title="書き出し・共有"
        left={{
          title: '‹ 戻る',
          onPress: () => {
            void saveName().finally(() => router.back());
          },
        }}
      />
      {load.status === 'error' ? (
        <OpenError />
      ) : !project || !loaded ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <>
          <View style={styles.panel}>
            <View style={styles.nameRow}>
              <Text style={styles.nameLabel} numberOfLines={1}>
                作品名
              </Text>
              <TextInput
                testID="export-name"
                defaultValue={loaded.name}
                onChangeText={setName}
                onEndEditing={() => void saveName()}
                placeholder={loaded.name}
                maxLength={40}
                clearButtonMode="while-editing"
                returnKeyType="done"
                autoCorrect={false}
                style={styles.nameInput}
                accessibilityLabel="作品名"
              />
            </View>
            <Text style={styles.small}>書き出すファイルの名前にもなります。</Text>
            <Button title="画像（PNG）で共有（必要なビーズ付き）" variant="secondary" disabled={busy} testID="export-png" onPress={() => void run((p) => sharePng(p.sheet, p.name))} />
            <Button title="型紙を印刷（実寸）" variant="secondary" disabled={busy} testID="export-print" onPress={() => void run((p) => printPdf(buildPrintHtml(p.sheet, p.name)))} />
            <Button title="型紙を PDF で共有" variant="secondary" disabled={busy} testID="export-pdf" onPress={() => void run((p) => sharePdf(buildPrintHtml(p.sheet, p.name), p.name))} />
            <Button
              title=".beads で共有（ほかの端末に渡す）"
              variant="secondary"
              disabled={busy}
              testID="export-beads"
              onPress={() => void run(async (p) => shareBeads(await beadsBytes(p), p.name))}
            />
            <Text style={styles.small}>印刷するときは倍率を「100%（実際のサイズ）」にしてください。1マス＝5mm です。</Text>
          </View>
          <Text style={styles.heading}>
            必要なビーズ ・ {counts.length}色 {total}ビーズ
          </Text>
          <FlatList
            style={styles.list}
            data={counts}
            keyExtractor={(c) => String(c.index)}
            renderItem={({ item }) => {
              const b = beadByIndex(item.index);
              return (
                <View style={styles.item}>
                  <View style={[styles.swatch, { backgroundColor: `rgb(${b.rgb.join(',')})` }]} />
                  <Text style={styles.itemText} numberOfLines={1}>
                    {b.name}
                    <Text style={styles.code}>（{b.code}）</Text>
                  </Text>
                  <Text style={styles.count}>{item.count}ビーズ</Text>
                </View>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, padding: 12, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 10, backgroundColor: colors.bg, paddingHorizontal: 12 },
  nameLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext, flexShrink: 0 },
  nameInput: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 17, color: colors.text, paddingVertical: 8 },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, flexShrink: 1 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 12, marginBottom: 4 },
  list: { flex: 1, backgroundColor: colors.panel, borderRadius: 12, marginBottom: 12 },
  item: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
  itemText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  code: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
