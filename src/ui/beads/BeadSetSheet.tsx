import { useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { allowsScroll, DRAG_IDLE, type DragSelectEvent, dragSelectStep, type DragSelectState } from '@/core/machines/dragSelect';
import { ALL32, BASIC8, BASIC16, beadByIndex, beadsForSet } from '@/core/palette/perler';
import type { BeadSet } from '@/core/palette/types';

import { NavBar } from '../NavBar';
import { Segmented } from '../Segmented';
import { colors, fonts } from '../theme';
import { BeadChip, CHIP_H, CHIP_W } from './BeadChip';
import { beadAt, beadGridLayout } from './beadGrid';

type SheetSet = Exclude<BeadSet, 'original'>;

const SETS: readonly { value: SheetSet; label: string }[] = [
  { value: '8', label: '8色' },
  { value: '16', label: '16色' },
  { value: '32', label: '32色' },
  { value: 'owned', label: '手持ち' },
];

/** 色の名前・品番でさがす（品番の「80-」や大文字小文字は気にしない） */
function matches(i: number, q: string): boolean {
  const query = q.trim();
  if (!query) return true;
  const b = beadByIndex(i);
  const code = b.code.toLowerCase().replace(/^80-/, '');
  return b.name.includes(query) || code.includes(query.toLowerCase().replace(/^80-/, ''));
}

interface Props {
  visible: boolean;
  beadSet: BeadSet;
  owned: readonly number[];
  /** この画像に合う色（64色で変換したときに使われる色）。計算中は null */
  recommended: readonly number[] | null;
  onSet(set: SheetSet): void;
  onOwned(list: number[]): void;
  onClose(): void;
}

/**
 * 「使うビーズ」の「…」で下から出る画面：8色・16色・32色・手持ち。
 * 手持ちは 64色から選ぶ：タップ・横になぞってまとめて選ぶ・ここから始めるボタン・名前や品番でさがす・この画像に合う色。
 */
export function BeadSetSheet({ visible, beadSet, owned, recommended, onSet, onOwned, onClose }: Props) {
  const [width, setWidth] = useState(0);
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<number | null>(null);
  const grid = useMemo(() => (width > 0 ? beadGridLayout(width, CHIP_W, CHIP_H) : null), [width]);
  const current: SheetSet = beadSet === 'original' ? '32' : beadSet;
  const editable = current === 'owned';
  const shown = editable ? owned : beadsForSet(current, owned);
  const recommendedSet = useMemo(() => new Set(recommended ?? []), [recommended]);

  // タップ・横になぞる（縦は画面のスクロール）。グリッド自身がタッチを受け、位置はグリッドの左上からの値（locationX/Y）。
  // 進み方は core/machines/dragSelect
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
    const point = (e: GestureResponderEvent) => {
      const x = e.nativeEvent.locationX;
      const y = e.nativeEvent.locationY;
      return { x, y, bead: grid ? beadAt(grid, x, y) : null };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      // 縦に動かしたら画面のスクロールに渡す（横になぞっている間は渡さない）
      onPanResponderTerminationRequest: () => allowsScroll(drag.current),
      onPanResponderGrant: (e) => {
        const p = point(e);
        if (p.bead) setLast(p.bead);
        step({ type: 'press', ...p });
      },
      onPanResponderMove: (e) => {
        const p = point(e);
        if (p.bead && drag.current.phase === 'painting') setLast(p.bead);
        step({ type: 'move', ...p });
      },
      onPanResponderRelease: () => step({ type: 'release' }),
      onPanResponderTerminate: () => step({ type: 'cancel' }),
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <NavBar title="使うビーズ" right={{ title: '完了', testID: 'bead-set-close', onPress: onClose }} />
        <View style={styles.center}>
          <Segmented<SheetSet> testID="bead-set" options={SETS} value={current} onChange={onSet} />
        </View>
        <Text style={styles.count} testID="bead-set-count">
          {editable ? `手持ち ${owned.length}色を選択中` : `${shown.length}色`}
        </Text>
        {editable ? (
          <>
            <View style={styles.quickRow}>
              {quick(`この画像に合う色（${recCount}）`, 'owned-add-recommended', recommended ?? [], recCount === 0)}
              {quick('8色を入れる', 'owned-add-8', BASIC8)}
              {quick('16色を入れる', 'owned-add-16', BASIC16)}
              {quick('32色を入れる', 'owned-add-32', ALL32)}
              {quick('すべて外す', 'owned-clear', null, owned.length === 0)}
            </View>
            <TextInput
              testID="owned-search"
              value={query}
              onChangeText={setQuery}
              placeholder="色の名前・品番でさがす（例：レモン、5005）"
              autoCorrect={false}
              returnKeyType="done"
              style={styles.search}
            />
          </>
        ) : (
          <Text style={styles.hint}>「手持ち」にすると、持っている色だけで作れます（64色から選べます）</Text>
        )}
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View
            testID="owned-grid"
            pointerEvents="box-only"
            style={{ height: grid?.height ?? 0 }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            {...responder.panHandlers}>
            {grid?.cells.map((c) => {
              const on = shown.includes(c.index);
              const b = beadByIndex(c.index);
              return (
                <View
                  key={c.index}
                  testID={`owned-${b.code}`}
                  accessibilityLabel={`${b.name} ${b.code}${on ? '（選択中）' : ''}`}
                  aria-selected={on}
                  style={{ position: 'absolute', left: c.x, top: c.y }}>
                  <BeadChip index={c.index} selected={on} recommended={recommendedSet.has(c.index)} dimmed={!matches(c.index, query)} />
                </View>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.status} numberOfLines={1} testID="owned-status">
          {last ? `${beadByIndex(last).name}（${beadByIndex(last).code}）` : editable ? 'タップで選ぶ・外す。横になぞるとまとめて（●＝合う色）' : ' '}
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  center: { alignItems: 'center', marginVertical: 8 },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 },
  quick: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.panel, justifyContent: 'center' },
  quickText: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent },
  search: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  status: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext, textAlign: 'center', paddingVertical: 6 },
});
