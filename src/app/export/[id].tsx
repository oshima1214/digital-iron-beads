import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildPrintHtml } from '@/core/export/print';
import { countsText } from '@/core/export/countsText';
import { base64ToBytes } from '@/core/file/base64';
import { packBeads } from '@/core/file/beads';
import type { Project } from '@/core/file/project';
import { beadByIndex } from '@/core/palette/perler32';
import { countBeads } from '@/core/sheet/counts';
import { printPdf, shareBeads, sharePdf, sharePng, shareText } from '@/platform/exporter';
import { projectRepo } from '@/platform/projectRepo';
import { Button } from '@/ui/Button';
import { notify } from '@/ui/dialogs';
import { NavBar } from '@/ui/NavBar';
import { OpenError } from '@/ui/OpenError';
import { colors, fonts } from '@/ui/theme';

/** 元画像のバイト列（.beads に入れる）。読めなければ null。 */
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

/** ⑥ 書き出し */
export default function Export() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectRepo
      .load(id)
      .then(setProject)
      .catch(() => setError(true));
  }, [id]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
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
      <NavBar title="書き出し・共有" left={{ title: '‹ 戻る', onPress: () => router.back() }} />
      {error ? (
        <OpenError />
      ) : !project ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <>
          <View style={styles.panel}>
            <Text style={styles.name} numberOfLines={1}>
              {project.name}
            </Text>
            <Button title="画像（PNG）で共有" disabled={busy} testID="export-png" onPress={() => void run(() => sharePng(project.sheet, project.name, mirror))} />
            <View style={styles.row}>
              <Text style={styles.small}>左右反転して書き出す（画像のみ）</Text>
              <Switch value={mirror} onValueChange={setMirror} />
            </View>
            <Button title="型紙を印刷（実寸）" variant="secondary" disabled={busy} testID="export-print" onPress={() => void run(() => printPdf(buildPrintHtml(project.sheet, project.name)))} />
            <Button title="型紙を PDF で共有" variant="secondary" disabled={busy} testID="export-pdf" onPress={() => void run(() => sharePdf(buildPrintHtml(project.sheet, project.name), project.name))} />
            <Button
              title=".beads ファイルで共有（ほかの端末に渡す）"
              variant="secondary"
              disabled={busy}
              testID="export-beads"
              onPress={() => void run(async () => shareBeads(packBeads(project, await readSource(project)), project.name))}
            />
            <Button title="必要なビーズをテキストで共有" variant="secondary" disabled={busy} testID="export-text" onPress={() => void run(() => shareText(countsText(project.name, project.sheet)))} />
            <Text style={styles.small}>印刷するときは倍率を「100%（実際のサイズ）」にしてください。1マス＝5mm です。</Text>
          </View>
          <Text style={styles.heading}>
            必要なビーズ ・ {counts.length}色 {total}粒
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
                  <Text style={styles.itemText}>
                    {b.code} {b.name}
                  </Text>
                  <Text style={styles.count}>{item.count}</Text>
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
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, flexShrink: 1 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 12, marginBottom: 4 },
  list: { flex: 1, backgroundColor: colors.panel, borderRadius: 12, marginBottom: 12 },
  item: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
  itemText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
