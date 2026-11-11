import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold, useFonts } from '@expo-google-fonts/biz-udpgothic';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { draftStore } from '@/state/draft';
import { editorStore } from '@/state/editor';
import { flushAll, flushOnBackground } from '@/state/lifecycle';
import { RootStack } from '@/ui/RootStack';

// Web（自動テスト用）: CanvasKit（public/canvaskit.wasm）の読み込みを待ってから描画する。
export default function RootLayoutWeb() {
  const [fontsLoaded, fontError] = useFonts({ BIZUDPGothic_400Regular, BIZUDPGothic_700Bold });
  useEffect(() => {
    const sub = flushOnBackground(
      AppState,
      flushAll(
        () => draftStore().getState().flush(),
        () => editorStore().getState().flush(),
      ),
    );
    return () => sub.remove();
  }, []);
  const [skiaReady, setSkiaReady] = useState(false);
  useEffect(() => {
    LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => setSkiaReady(true));
  }, []);
  if ((!fontsLoaded && !fontError) || !skiaReady) return null;
  return <RootStack />;
}
