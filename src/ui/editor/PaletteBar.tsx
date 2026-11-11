import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PERLER32 } from '@/core/palette/perler32';
import { countBeads } from '@/core/sheet/counts';
import { editorStore, useEditor } from '@/state/editor';

import { colors } from '../theme';

export const PALETTE_HEIGHT = 52;

/** 32色を横1列に。シートで使っている色を多い順に先頭へ。この行の中だけ横にスクロールする。 */
export function PaletteBar() {
  const color = useEditor((s) => s.color);
  const project = useEditor((s) => s.project);
  const version = useEditor((s) => s.version);
  const order = useMemo(() => {
    if (!project) return PERLER32;
    const used = countBeads(project.sheet).map((c) => c.index);
    return [...used.map((i) => PERLER32[i - 1]), ...PERLER32.filter((b) => !used.includes(b.index))];
    // version はシートの中身の変化を知らせるため
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, version]);
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
              accessibilityLabel={`${item.code} ${item.name}`}
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
