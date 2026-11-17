import { useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DRAG_IDLE, type DragSelectEvent, dragSelectStep, type DragSelectState } from '@/core/machines/dragSelect';
import { ALL32, BASIC8, BASIC16, beadByIndex, beadsForSet } from '@/core/palette/perler';
import type { BeadSet } from '@/core/palette/types';

import { Segmented } from '../Segmented';
import { colors, fonts } from '../theme';
import { beadAt, beadGridLayout } from './beadGrid';

type PanelSet = Exclude<BeadSet, 'original'>;

const SETS: readonly { value: PanelSet; label: string }[] = [
  { value: '8', label: '8色' },
  { value: '16', label: '16色' },
  { value: '32', label: '32色' },
  { value: 'owned', label: '手持ち' },
];

const rgb = (i: number) => {
  const [r, g, b] = beadByIndex(i).rgb;
  return `rgb(${r},${g},${b})`;
};

/** 品番・色名でさがす（「80-」や大文字小文字は気にしない） */
function matches(i: number, q: string): boolean {
  const query = q.trim().toLowerCase().replace(/^80-/, '');
  if (!query) return true;
  const b = beadByIndex(i);
  return b.code.toLowerCase().replace(/^80-/, '').includes(query) || b.name.includes(q.trim());
}

interface Props {
  beadSet: BeadSet;
  owned: readonly number[];
  /** この画像に合う色（64色で変換したときに使われる色）。計算中は null */
  recommended: readonly number[] | null;
  onSet(set: PanelSet): void;
  onOwned(list: number[]): void;
  onClose(): void;
}

/**
 * 「使うビーズ」の「…」で開くパネル：8色・16色・32色・手持ち。
 * 手持ちは 64色から選ぶ（なぞってまとめて選ぶ・ここから始めるボタン・品番でさがす・この画像に合う色）。
 */
export function BeadSetPanel({ beadSet, owned, recommended, onSet, onOwned, onClose }: Props) {
  const [width, setWidth] = useState(0);
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<number | null>(null);
  const grid = useMemo(() => (width > 0 ? beadGridLayout(width) : null), [width]);
  const current: PanelSet = beadSet === 'original' ? '32' : beadSet;
  const editable = current === 'owned';
  const shown = editable ? owned : beadsForSet(current, owned);
  const recommendedSet = useMemo(() => new Set(recommended ?? []), [recommended]);

  // なぞって選ぶ：状態機械（core/machines/dragSelect）を PanResponder から進める
  const drag = useRef<DragSelectState>(DRAG_IDLE);
  const ownedRef = useRef(owned);
  useEffect(() => {
    ownedRef.current = owned;
  }, [owned]);
  /* eslint-disable react-hooks/refs */
  const responder = useMemo(() => {
    const step = (e: DragSelectEvent) => {
      const r = dragSelectStep(drag.current, ownedRef.current, e);
      drag.current = r.state;
      if (r.owned.length !== ownedRef.current.length || r.owned.some((v, i) => v !== ownedRef.current[i])) {
        ownedRef.current = r.owned;
        onOwned(r.owned);
      }
    };
    const beadOf = (e: GestureResponderEvent) => (grid ? beadAt(grid, e.nativeEvent.locationX, e.nativeEvent.locationY) : null);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onPanResponderGrant: (e) => {
        const bead = beadOf(e);
        if (bead) setLast(bead);
        step({ type: 'press', bead });
      },
      onPanResponderMove: (e) => step({ type: 'move', bead: beadOf(e) }),
      onPanResponderRelease: () => step({ type: 'release' }),
      onPanResponderTerminate: () => step({ type: 'release' }),
    });
  }, [grid, editable, onOwned]);
  /* eslint-enable react-hooks/refs */

  const recCount = recommended?.length ?? 0;
  const quick = (label: string, testID: string, list: readonly number[] | null, disabled = false) => (
    <Pressable
      key={testID}
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={() => onOwned(list ? beadsForSet('owned', [...owned, ...list]) : [])}
      style={[styles.quick, disabled && { opacity: 0.4 }]}>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.panel} testID="bead-set-panel">
      <View style={styles.head}>
        <Text style={styles.title}>使うビーズ</Text>
        <Text style={styles.count} testID="bead-set-count">
          {editable ? `手持ち ${owned.length}色を選択中` : `${shown.length}色`}
        </Text>
        <Pressable accessibilityRole="button" testID="bead-set-close" onPress={onClose} hitSlop={8} style={styles.close}>
          <Text style={styles.closeText}>閉じる</Text>
        </Pressable>
      </View>
      <View style={styles.center}>
        <Segmented<PanelSet> testID="bead-set" options={SETS} value={current} onChange={onSet} />
      </View>
      {editable ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow} keyboardShouldPersistTaps="handled">
            {quick(`この画像に合う色（${recCount}）`, 'owned-add-recommended', recommended ?? [], recCount === 0)}
            {quick('8色を入れる', 'owned-add-8', BASIC8)}
            {quick('16色を入れる', 'owned-add-16', BASIC16)}
            {quick('32色を入れる', 'owned-add-32', ALL32)}
            {quick('すべて外す', 'owned-clear', null, owned.length === 0)}
          </ScrollView>
          <TextInput
            testID="owned-search"
            value={query}
            onChangeText={setQuery}
            placeholder="品番・色名でさがす（例：5005、レモン）"
            autoCorrect={false}
            returnKeyType="done"
            style={styles.search}
          />
        </>
      ) : (
        <Text style={styles.hint}>「手持ち」にすると、持っている色だけで作れます（64色から選べます）</Text>
      )}
      <ScrollView style={styles.gridScroll} keyboardShouldPersistTaps="handled">
        <View
          testID="owned-grid"
          pointerEvents="box-only"
          style={{ height: grid?.height ?? 0 }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          {...responder.panHandlers}>
          {grid?.rows.map((r) => (
            <Text key={r.family} style={[styles.family, { top: r.y }]}>
              {r.label}
            </Text>
          ))}
          {grid?.cells.map((c) => {
            const on = shown.includes(c.index);
            const hit = matches(c.index, query);
            const b = beadByIndex(c.index);
            return (
              <View
                key={c.index}
                testID={`owned-${b.code}`}
                accessibilityLabel={`${b.code} ${b.name}${on ? '（選択中）' : ''}`}
                aria-selected={on}
                style={[styles.cell, { left: c.x, top: c.y, width: grid.size, height: grid.size, opacity: hit ? 1 : 0.2 }]}>
                <View style={[styles.swatch, { backgroundColor: rgb(c.index) }, on && styles.swatchOn]} />
                {on && <Text style={styles.check}>✓</Text>}
                {recommendedSet.has(c.index) && <View style={styles.rec} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.status} numberOfLines={1} testID="owned-status">
        {last ? `${beadByIndex(last).code} ${beadByIndex(last).name}` : editable ? 'タップで選ぶ・外す。なぞるとまとめて選べます（●＝合う色）' : ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.panel, borderRadius: 12, marginBottom: 12, paddingHorizontal: 12, paddingBottom: 6, flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  count: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.subtext },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  closeText: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
  center: { alignItems: 'center', marginBottom: 6 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, marginBottom: 6, textAlign: 'center' },
  quickRow: { gap: 6, paddingBottom: 6 },
  quick: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.bg, justifyContent: 'center' },
  quickText: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent },
  search: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  gridScroll: { flexGrow: 0, flexShrink: 1 },
  family: { position: 'absolute', left: 0, width: 32, fontFamily: fonts.regular, fontSize: 11, color: colors.subtext, lineHeight: 28 },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: '100%', height: '100%', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  swatchOn: { borderWidth: 3, borderColor: colors.accent },
  check: { position: 'absolute', fontFamily: fonts.bold, fontSize: 13, color: '#fff', textShadowColor: '#000', textShadowRadius: 2 },
  rec: { position: 'absolute', right: -2, top: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.panel },
  status: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, marginTop: 6 },
});
