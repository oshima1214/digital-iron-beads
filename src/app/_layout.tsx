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
import type { TitleScreen as TitleScreenType } from '@/ui/TitleScreen';

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
  // 起動したときだけタイトルを出す（showing → done。ホームなどはその下で先に用意しておく）
  const [title, setTitle] = useState<'showing' | 'done'>('showing');
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  // タイトル画面は Skia を使うので、Skia の読み込み（Web）が済んでから読み込む
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TitleScreen = (require('@/ui/TitleScreen') as { TitleScreen: typeof TitleScreenType }).TitleScreen;

  return (
    <>
      <RootStack />
      {title === 'showing' && <TitleScreen onDone={() => setTitle('done')} />}
    </>
  );
}
