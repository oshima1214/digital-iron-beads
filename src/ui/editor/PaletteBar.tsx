import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PALETTE } from '@/core/palette/perler';
import { countBeads } from '@/core/sheet/counts';
import { editorStore, useEditor } from '@/state/editor';

import { colors } from '../theme';

export const PALETTE_HEIGHT = 52;

/** 32色を横1列に。シートで使っている色を多い順に先頭へ。この行の中だけ横にスクロールする。 */
export function PaletteBar() {
  const color = useEditor((s) => s.color);
  const project = useEditor((s) => s.project);
  const committed = useEditor((s) => s.committed);
  const order = useMemo(() => {
    if (!project) return PALETTE;
    const used = countBeads(project.sheet).map((c) => c.index);
    return [...used.map((i) => PALETTE[i - 1]), ...PALETTE.filter((b) => !used.includes(b.index))];
    // committed は編集の確定を知らせるため（ストロークの途中では並べ替えない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, committed]);
  return (
    <View style={styles.bar}>
      <FlatList
        horizontal
        data={order}
        keyExtractor={(b) => String(b.index)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const on = item.index === color;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}（${item.code}）`}
              testID={`color-${item.code}`}
              onPress={() => editorStore().getState().setColor(item.index)}
              style={[styles.ring, on && styles.ringOn]}>
              <View style={[styles.chip, { backgroundColor: `rgb(${item.rgb.join(',')})` }]} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: PALETTE_HEIGHT },
  content: { alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  ring: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  ringOn: { borderColor: colors.accent },
  chip: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
});
