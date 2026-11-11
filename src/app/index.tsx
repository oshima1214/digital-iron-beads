import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProjectSummary } from '@/core/file/project';
import { draftStore } from '@/state/draft';
import { editorStore } from '@/state/editor';
import { flushAll } from '@/state/lifecycle';
import { navStore } from '@/state/nav';
import { projectsStore, useProjects } from '@/state/projects';
import { Button } from '@/ui/Button';
import { confirmDestructive, promptText, showMenu } from '@/ui/dialogs';
import { ProjectCard } from '@/ui/ProjectCard';
import { colors, fonts } from '@/ui/theme';

const GAP = 12;

export default function Home() {
  const items = useProjects((s) => s.items);
  const [width, setWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // 作成中の下書きと編集中の作品を保存して閉じてから一覧を読み直す（古い下書きが名前変更・削除を上書きしないように）
      void flushAll(
        () => draftStore().getState().close(),
        () => editorStore().getState().close(),
        () => navStore().getState().close(),
      )()
        .then(() => projectsStore().getState().refresh())
        .catch((e) => console.warn(e));
    }, []),
  );

  const columns = width >= 700 ? 4 : 2;
  const cardSize = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) - 16 : 0;

  const open = (item: ProjectSummary) => {
    if (item.stage === 'setup') router.push({ pathname: '/new/convert', params: { id: item.id } });
    else router.push({ pathname: '/project/[id]', params: { id: item.id } });
  };

  const menu = async (item: ProjectSummary) => {
    const actions = projectsStore().getState();
    const choice = await showMenu(item.name, ['名前を変更', '複製', '削除'], 2);
    if (choice === 0) {
      const name = await promptText('名前を変更', item.name);
      if (name !== null) await actions.rename(item.id, name);
    } else if (choice === 1) {
      await actions.duplicate(item.id);
    } else if (choice === 2) {
      if (await confirmDestructive(`「${item.name}」を削除しますか？`, 'この操作は取り消せません。', '削除')) await actions.remove(item.id);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Text style={styles.title}>作品</Text>
      <View style={styles.list} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>まだ作品がありません</Text>
          </View>
        ) : (
          cardSize > 0 && (
            <FlatList
              key={columns}
              data={items}
              numColumns={columns}
              keyExtractor={(i) => i.id}
              columnWrapperStyle={{ gap: GAP }}
              contentContainerStyle={{ gap: GAP, paddingBottom: GAP }}
              renderItem={({ item }) => (
                <ProjectCard item={item} size={cardSize} onPress={() => open(item)} onLongPress={() => void menu(item)} />
              )}
            />
          )
        )}
      </View>
      <Button title="＋ 新しく作る" onPress={() => router.push('/new')} testID="new-project" style={styles.newButton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, marginTop: 12, marginBottom: 12 },
  list: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext },
  newButton: { marginVertical: 12 },
});
