import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/ui/theme';

export default function Home() {
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>作品</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>まだ作品がありません</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, marginTop: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.subtext },
});
