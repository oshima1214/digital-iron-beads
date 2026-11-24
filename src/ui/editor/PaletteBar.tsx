import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { beadByIndex, PALETTE } from '@/core/palette/perler';
import { editorPalette } from '@/core/palette/projectBeads';
import { countBeads } from '@/core/sheet/counts';
import { editorStore, useEditor } from '@/state/editor';

import { colors, fonts } from '../theme';

export const PALETTE_HEIGHT = 52;

/**
 * 選べる色を横1列に（作品を作ったときの使うビーズだけ。16色で作ったなら16色）。
 * シートで使っている色は多い順に先頭へ並べ、数のバッジを付けて強調する。使っていない色は区切り線のあとに薄く出す。
 * 左に、使っている色の数と、今選んでいる色の名前と品番を出す。この行の中だけ横にスクロールする。
 */
export function PaletteBar() {
  const color = useEditor((s) => s.color);
  const project = useEditor((s) => s.project);
  const committed = useEditor((s) => s.committed);
  const { order, usedCount } = useMemo(() => {
    if (!project) return { order: [], usedCount: 0 };
    const pal = editorPalette(project);
    const counts = countBeads(project.sheet);
    const used = counts.map((c) => c.index);
    const items = [
      ...counts.map((c) => ({ bead: PALETTE[c.index - 1], count: c.count })),
      ...pal.filter((i) => !used.includes(i)).map((i) => ({ bead: PALETTE[i - 1], count: 0 })),
    ];
    return { order: items, usedCount: counts.length };
    // committed は編集の確定を知らせるため（ストロークの途中では並べ替えない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, committed]);
  const cur = beadByIndex(color);
  return (
    <View style={styles.bar}>
      <View style={styles.current} testID="palette-current" accessibilityLabel={`選んでいる色：${cur.name}（${cur.code}）`}>
        <Text style={styles.curLabel} testID="palette-used">
          使用 {usedCount}色／{order.length}色
        </Text>
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
        keyExtractor={(x) => String(x.bead.index)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        renderItem={({ item, index }) => {
          const b = item.bead;
          const on = b.index === color;
          const used = item.count > 0;
          // 使っていない色の始まりに区切り線
          const firstUnused = !used && index === usedCount && usedCount > 0;
          return (
            <View style={styles.cell}>
              {firstUnused && <View style={styles.divider} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${b.name}（${b.code}）${used ? `・使用中 ${item.count}ビーズ` : ''}`}
                testID={`color-${b.code}`}
                onPress={() => editorStore().getState().setColor(b.index)}
                style={[styles.ring, on && styles.ringOn, !used && !on && styles.unused]}>
                <View style={[styles.chip, used && styles.chipUsed, { backgroundColor: `rgb(${b.rgb.join(',')})` }]} />
                {used && (
                  <View style={styles.badge} testID={`color-count-${b.code}`}>
                    <Text style={styles.badgeText}>{item.count}</Text>
                  </View>
                )}
              </Pressable>
            </View>
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
  chip: { width: 26, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
  // 使っている色：大きく、濃い縁。使っていない色：薄く
  chipUsed: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#3A3A3C' },
  unused: { opacity: 0.4 },
  cell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 30, backgroundColor: colors.separator, marginHorizontal: 4 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 20,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF' },
});
