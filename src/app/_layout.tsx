import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold, useFonts } from '@expo-google-fonts/biz-udpgothic';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { loadSkia } from '@/platform/skiaReady';
import { draftStore } from '@/state/draft';
import { editorStore } from '@/state/editor';
import { flushAll, flushOnBackground } from '@/state/lifecycle';
import { navStore } from '@/state/nav';
import { RootStack } from '@/ui/RootStack';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ BIZUDPGothic_400Regular, BIZUDPGothic_700Bold });

  useEffect(() => {
    const sub = flushOnBackground(
      AppState,
      flushAll(
        () => draftStore().getState().flush(),
        () => editorStore().getState().flush(),
        () => navStore().getState().flush(),
      ),
    );
    return () => sub.remove();
  }, []);

  // Web では CanvasKit の読み込みを待つ（iOS ではすぐ終わる）
  const [skiaReady, setSkiaReady] = useState(false);
  useEffect(() => {
    loadSkia()
      .catch((e) => console.warn('Skia could not be loaded', e))
      .finally(() => setSkiaReady(true));
  }, []);

  const ready = (loaded || !!error) && skiaReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return <RootStack />;
}
