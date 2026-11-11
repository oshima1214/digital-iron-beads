import { BIZUDPGothic_400Regular, BIZUDPGothic_700Bold, useFonts } from '@expo-google-fonts/biz-udpgothic';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { RootStack } from '@/ui/RootStack';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ BIZUDPGothic_400Regular, BIZUDPGothic_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <RootStack />;
}
