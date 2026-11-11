import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Project } from '@/core/file/project';
import { beadByIndex } from '@/core/palette/perler32';
import { countBeads } from '@/core/sheet/counts';
import { projectRepo } from '@/platform/projectRepo';
import { NavBar } from '@/ui/NavBar';
import { SheetCanvas } from '@/ui/SheetCanvas';
import { colors, fonts } from '@/ui/theme';

const TOP = 8;

/** M3 で編集画面になるまでの仮の作品画面：シートと必要なビーズを表示する。 */
export default function ProjectView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    projectRepo
      .load(id)
      .then(setProject)
      .catch(() => setError(true));
  }, [id]);

  const counts = project ? countBeads(project.sheet) : [];
  const total = counts.reduce((a, c) => a + c.count, 0);
  const rest = counts.slice(TOP);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar title={project?.name ?? ''} left={{ title: '‹ ホーム', onPress: () => router.dismissTo('/') }} />
      <View style={styles.sheet} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {error ? (
          <Text style={styles.muted}>この作品を開けませんでした</Text>
        ) : project && box.w > 0 ? (
          <SheetCanvas testID="project-sheet" sheet={project.sheet} width={box.w} height={box.h} />
        ) : (
          <ActivityIndicator />
        )}
      </View>
      {project && (
        <View style={styles.panel}>
          <Text style={styles.heading}>
            必要なビーズ ・ {counts.length}色 {total}粒
          </Text>
          <View style={styles.counts}>
            {counts.slice(0, TOP).map((c) => {
              const b = beadByIndex(c.index);
              return (
                <View key={c.index} style={styles.count}>
                  <View style={[styles.swatch, { backgroundColor: `rgb(${b.rgb.join(',')})` }]} />
                  <Text style={styles.countText}>
                    {b.code} {b.name} {c.count}
                  </Text>
                </View>
              );
            })}
            {rest.length > 0 && <Text style={styles.muted}>ほか {rest.length}色</Text>}
          </View>
          <Text style={styles.muted}>編集・制作ナビは次のバージョンで使えるようになります</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  sheet: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 140 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  countText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
});
