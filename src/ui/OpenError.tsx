import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, fonts } from './theme';

/** 作品を開けなかったときの表示（スピナーのまま止まらないように）。 */
export function OpenError() {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>この作品を開けませんでした</Text>
      <Button title="ホームへ" variant="secondary" onPress={() => router.dismissTo('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12 },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext },
});
