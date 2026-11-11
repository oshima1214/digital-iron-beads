import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold, useFonts } from '@expo-google-fonts/biz-udpgothic';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { draftStore } from '@/state/draft';
import { flushOnBackground } from '@/state/lifecycle';
import { RootStack } from '@/ui/RootStack';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ BIZUDPGothic_400Regular, BIZUDPGothic_700Bold });

  useEffect(() => {
    const sub = flushOnBackground(AppState, () => draftStore().getState().flush());
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <RootStack />;
}
