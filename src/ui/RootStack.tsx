import { Stack } from 'expo-router';

import { NO_SWIPE_BACK_ROUTES } from './stackGestures';
import { colors } from './theme';

export function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* 宣言した画面が並び順の先頭になるので、ホームを最初に置く */}
      <Stack.Screen name="index" />
      {NO_SWIPE_BACK_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} options={{ gestureEnabled: false }} />
      ))}
    </Stack>
  );
}
