import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, type LayoutChangeEvent, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createProject } from '@/core/file/project';
import { beadByIndex, PERLER32 } from '@/core/palette/perler32';
import type { Sheet, SheetSize } from '@/core/sheet/sheet';
import { maskToCells, placeText, textKey, textLayout, textLimitMessage } from '@/core/text/layout';
import { projectRepo } from '@/platform/projectRepo';
import { renderTextMask } from '@/platform/textMask';
import { projectsStore } from '@/state/projects';
import { BeadOnePicker } from '@/ui/BeadPicker';
import { notify } from '@/ui/dialogs';
import { NavBar } from '@/ui/NavBar';
import { Segmented } from '@/ui/Segmented';
import { RowValue, SettingRow } from '@/ui/SettingRow';
import { SheetCanvas } from '@/ui/SheetCanvas';
import { colors, fonts } from '@/ui/theme';

const SIZES = [13, 21, 29, 58, 116].map((v) => ({ value: v as SheetSize, label: String(v) }));
const idx = (code: string) => PERLER32.find((b) => b.code === code)!.index;
const MASK_CELL_PX = 16;
/** マスの 35% 以上が文字なら文字のマスにする（0.5 だと細い部分が途切れる） */
const TEXT_THRESHOLD = 0.35;

/** 文字から作る：文字・大きさ・文字の色・背景を選んで、そのまま作品にする。 */
export default function NewText() {
  const [text, setText] = useState('');
  const [size, setSize] = useState<SheetSize>(29);
  const [fg, setFg] = useState(idx('5018'));
  const [bg, setBg] = useState(0);
  const [picker, setPicker] = useState<null | 'fg' | 'bg'>(null);
  // プレビューと、それを作った入力の組み合わせ（入力が変わったら古いプレビューでは作成しない）
  const [preview, setPreview] = useState<{ key: string; sheet: Sheet } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const layout = useMemo(() => textLayout(text, size), [text, size]);
  const key = textKey({ text, size, fg, bg });
  const sheet = preview?.key === key ? preview.sheet : null;
  const limit = textLimitMessage(layout);

  // 入力が変わったら少し待ってからプレビューを作り直す
  useEffect(() => {
    if (!layout.fits) return;
    let alive = true;
    const t = setTimeout(() => {
      void renderTextMask(text, layout, MASK_CELL_PX)
        .then(({ mask, w, h }) => {
          if (!alive) return;
          const cells = maskToCells(mask, w, h, MASK_CELL_PX, fg, bg, TEXT_THRESHOLD);
          setPreview({ key: textKey({ text, size, fg, bg }), sheet: placeText(cells, layout.totalW, layout.charH, size) });
        })
        .catch((e) => console.warn(e));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text, layout, size, fg, bg]);

  // 入力は止めない（日本語の変換中に止めると変換が壊れるため）。入らないときは説明を出して作成を無効にする
  const onChangeText = (v: string) => setText(v);

  const create = async () => {
    if (!sheet || !layout.fits) return;
    setBusy(true);
    try {
      const p = createProject(text, sheet, new Date());
      await projectRepo.save(p);
      void projectsStore().getState().refresh();
      router.replace({ pathname: '/project/[id]', params: { id: p.id } });
    } catch (e) {
      console.warn(e);
      notify('保存できませんでした', '端末の空き容量を確認して、もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  const label = (i: number) => (i === 0 ? 'なし' : `${beadByIndex(i).code} ${beadByIndex(i).name}`);
  const canCreate = layout.fits && !!sheet && !busy;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <NavBar
          title="文字から作る"
          left={{ title: '‹ 戻る', onPress: () => router.back() }}
          right={{ title: '作成', testID: 'text-create', disabled: !canCreate, onPress: () => void create() }}
        />
        <View style={styles.preview} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {sheet && layout.fits && box.w > 0 ? (
            <SheetCanvas testID="text-preview" sheet={sheet} width={box.w} height={box.h} />
          ) : (
            <Text style={[styles.hint, limit && styles.warn]} testID="text-limit">
              {limit ?? '文字を入力してください'}
            </Text>
          )}
        </View>
        <View style={styles.panel}>
          <TextInput
            testID="text-input"
            value={text}
            onChangeText={onChangeText}
            placeholder={`例：ゆい（全角${layout.maxFull}文字・半角${layout.maxFull * 2}文字まで）`}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="done"
          />
          <SettingRow label="サイズ">
            <Segmented<SheetSize>
              testID="text-size"
              options={SIZES}
              value={size}
              onChange={setSize}
            />
          </SettingRow>
          <SettingRow label="文字の色" onPress={() => setPicker('fg')} testID="text-fg">
            <RowValue text={label(fg)} />
          </SettingRow>
          <SettingRow label="背景" onPress={() => setPicker('bg')} testID="text-bg" last>
            <RowValue text={label(bg)} />
          </SettingRow>
        </View>
      </KeyboardAvoidingView>
      <BeadOnePicker
        visible={picker !== null}
        title={picker === 'bg' ? '背景の色（もう一度同じ色を押すと「なし」）' : '文字の色'}
        value={picker === 'bg' ? bg : fg}
        onClose={(v) => {
          // 色のチップを押したときだけ呼ばれる（閉じる・スワイプでは onCancel）
          if (picker === 'fg') setFg(v);
          else if (picker === 'bg') setBg(v === bg ? 0 : v);
          setPicker(null);
        }}
        onCancel={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext, textAlign: 'center' },
  warn: { color: '#FF3B30', fontFamily: fonts.bold },
  panel: { backgroundColor: colors.panel, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  input: { minHeight: 48, fontFamily: fonts.bold, fontSize: 20, color: colors.text, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
});
