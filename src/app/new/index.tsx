import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createProject } from '@/core/file/project';
import { createSheet, type SheetSize } from '@/core/sheet/sheet';
import { loadRgba } from '@/platform/pixels';
import { projectRepo } from '@/platform/projectRepo';
import { draftStore } from '@/state/draft';
import { projectsStore } from '@/state/projects';
import { Button } from '@/ui/Button';
import { notify, showMenu } from '@/ui/dialogs';
import { NavBar } from '@/ui/NavBar';
import { colors, fonts } from '@/ui/theme';

const SIZES: SheetSize[] = [13, 21, 29, 58, 116];

function defaultName(): string {
  return `作品 ${projectsStore().getState().items.length + 1}`;
}

export default function NewSource() {
  const [busy, setBusy] = useState(false);

  const fromPhoto = async () => {
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
      if (res.canceled || !res.assets?.[0]) return;
      const img = await loadRgba(res.assets[0].uri);
      const id = await draftStore().getState().startFromImage(img, defaultName());
      router.replace({ pathname: '/new/prepare', params: { id } });
    } catch (e) {
      console.warn(e);
      notify('写真を読み込めませんでした', '設定アプリで写真へのアクセスを許可してください。');
    } finally {
      setBusy(false);
    }
  };

  const blank = async () => {
    const i = await showMenu('シートの大きさ', SIZES.map((s) => `${s} × ${s}`));
    if (i === null) return;
    const p = createProject(defaultName(), createSheet(SIZES[i], SIZES[i]), new Date());
    await projectRepo.save(p);
    router.replace({ pathname: '/project/[id]', params: { id: p.id } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar title="新しく作る" left={{ title: '‹ 戻る', onPress: () => router.back() }} />
      <View style={styles.body}>
        <Text style={styles.lead}>何から作りますか？</Text>
        <Button title="写真から作る" onPress={() => void fromPhoto()} disabled={busy} testID="source-photo" style={styles.big} />
        <Button title="文字から作る（準備中）" onPress={() => {}} disabled variant="secondary" style={styles.big} />
        <Button title="白紙から作る" onPress={() => void blank()} disabled={busy} variant="secondary" testID="source-blank" style={styles.big} />
        {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  body: { flex: 1, justifyContent: 'center', gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center', marginBottom: 8 },
  big: { minHeight: 64 },
});
