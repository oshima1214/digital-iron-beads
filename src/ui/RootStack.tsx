import { Stack } from 'expo-router';

import { colors } from './theme';

export function RootStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
