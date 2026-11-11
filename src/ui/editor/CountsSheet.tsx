import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { beadByIndex } from '@/core/palette/perler32';
import type { BeadCount } from '@/core/sheet/counts';

import { NavBar } from '../NavBar';
import { colors, fonts } from '../theme';

/** 品番ごとの必要数の一覧（この一覧の中だけスクロールする）。 */
export function CountsSheet({ visible, counts, onClose }: { visible: boolean; counts: BeadCount[]; onClose(): void }) {
  const total = counts.reduce((a, c) => a + c.count, 0);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <NavBar title="必要なビーズ" right={{ title: '閉じる', testID: 'counts-close', onPress: onClose }} />
        <Text style={styles.total}>
          {counts.length}色 ・ {total}粒
        </Text>
        <FlatList
          data={counts}
          keyExtractor={(c) => String(c.index)}
          renderItem={({ item }) => {
            const b = beadByIndex(item.index);
            return (
              <View style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: `rgb(${b.rgb.join(',')})` }]} />
                <Text style={styles.code}>{b.code}</Text>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={styles.count}>{item.count}</Text>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  total: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginVertical: 8 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#AEAEB2' },
  code: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, width: 48 },
  name: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  count: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
