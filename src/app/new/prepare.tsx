import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { adjustImage, type CropRect, resizeMax } from '@/core/image/adjust';
import { draftStore, useDraft } from '@/state/draft';
import { useDraftFor } from '@/state/useDraftFor';
import { Button } from '@/ui/Button';
import { CropBox } from '@/ui/CropBox';
import { LabeledSlider } from '@/ui/LabeledSlider';
import { NavBar } from '@/ui/NavBar';
import { OpenError } from '@/ui/OpenError';
import { RgbaView } from '@/ui/RgbaView';
import { colors } from '@/ui/theme';

const PREVIEW_MAX = 512;

export default function Prepare() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useDraftFor(id);
  const ready = status === 'ready';
  const image = useDraft((s) => s.image);
  const source = useDraft((s) => s.project?.source);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [b, setB] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const brightness = b ?? source?.brightness ?? 0;
  const contrast = c ?? source?.contrast ?? 0;

  const small = useMemo(() => (image ? resizeMax(image, PREVIEW_MAX) : null), [image]);
  const shown = useMemo(() => (small ? adjustImage(small, brightness, contrast) : null), [small, brightness, contrast]);

  const onCrop = useCallback((r: CropRect) => draftStore().getState().setCrop(r), []);
  const commitAdjust = (nb: number, nc: number) => draftStore().getState().setAdjust(Math.round(nb), Math.round(nc));

  let display = { w: 0, h: 0 };
  if (image && box.w > 0) {
    const s = Math.min(box.w / image.width, box.h / image.height);
    display = { w: Math.floor(image.width * s), h: Math.floor(image.height * s) };
  }
  const rect = source?.crop ?? (image ? { x: 0, y: 0, w: image.width, h: image.height } : null);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <NavBar
        title="下ごしらえ"
        left={{ title: '‹ 戻る', onPress: () => router.back() }}
        right={{ title: '次へ', testID: 'prepare-next', disabled: !ready, onPress: () => router.push({ pathname: '/new/convert', params: { id } }) }}
      />
      <View style={styles.imageArea} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {status === 'error' ? (
          <OpenError />
        ) : !ready || !shown || !image || !rect ? (
          <ActivityIndicator />
        ) : (
          display.w > 0 && (
            <View style={{ width: display.w, height: display.h }}>
              <RgbaView image={shown} width={display.w} height={display.h} />
              <CropBox imgW={image.width} imgH={image.height} displayW={display.w} displayH={display.h} rect={rect} onChange={onCrop} />
            </View>
          )
        )}
      </View>
      <View style={styles.panel}>
        <LabeledSlider label="明るさ" testID="brightness" value={brightness} min={-100} max={100} onChange={setB} onComplete={(v) => commitAdjust(v, contrast)} />
        <LabeledSlider label="コントラスト" testID="contrast" value={contrast} min={-100} max={100} onChange={setC} onComplete={(v) => commitAdjust(brightness, v)} />
        <Button
          title="元に戻す"
          variant="plain"
          onPress={() => {
            setB(0);
            setC(0);
            const st = draftStore().getState();
            st.setAdjust(0, 0);
            st.setCrop(undefined);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  imageArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  panel: { backgroundColor: colors.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
});
