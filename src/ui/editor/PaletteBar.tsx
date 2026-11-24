import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { beadByIndex, PALETTE } from '@/core/palette/perler';
import { editorPalette } from '@/core/palette/projectBeads';
import { countBeads } from '@/core/sheet/counts';
import { editorStore, useEditor } from '@/state/editor';

import { colors, fonts } from '../theme';

export const PALETTE_HEIGHT = 52;

/**
 * 選べる色を横1列に（作品を作ったときの使うビーズだけ。16色で作ったなら16色）。シートで使っている色を多い順に先頭へ。
 * 左に、今選んでいる色の名前と品番を出す。この行の中だけ横にスクロールする。
 */
export function PaletteBar() {
  const color = useEditor((s) => s.color);
  const project = useEditor((s) => s.project);
  const committed = useEditor((s) => s.committed);
  const order = useMemo(() => {
    if (!project) return [];
    const pal = editorPalette(project);
    const used = countBeads(project.sheet).map((c) => c.index);
    return [...used.map((i) => PALETTE[i - 1]), ...pal.filter((i) => !used.includes(i)).map((i) => PALETTE[i - 1])];
    // committed は編集の確定を知らせるため（ストロークの途中では並べ替えない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, committed]);
  const cur = beadByIndex(color);
  return (
    <View style={styles.bar}>
      <View style={styles.current} testID="palette-current" accessibilityLabel={`選んでいる色：${cur.name}（${cur.code}）`}>
        <Text style={styles.curLabel}>{order.length}色から</Text>
        <Text style={styles.curName} numberOfLines={1}>
          {cur.name}
        </Text>
        <Text style={styles.curCode} numberOfLines={1}>
          （{cur.code}）
        </Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        // 多くても64色なので、最初から全部描く（あとから出てくると色を探しにくい）
        initialNumToRender={64}
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
  bar: { height: PALETTE_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  // 今選んでいる色（名前を大きく、品番は小さく）
  current: { width: 96, paddingHorizontal: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.separator },
  curLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.subtext },
  curName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  curCode: { fontFamily: fonts.regular, fontSize: 11, color: colors.subtext },
  content: { alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  ring: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  ringOn: { borderColor: colors.accent },
  chip: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
});
