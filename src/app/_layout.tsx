import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold, useFonts } from '@expo-google-fonts/biz-udpgothic';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

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

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <RootStack />;
}
