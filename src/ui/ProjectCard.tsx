import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProjectSummary } from '@/core/file/project';

import { SheetThumb } from './SheetThumb';
import { colors, fonts } from './theme';

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  item: ProjectSummary;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
}

export function ProjectCard({ item, size, onPress, onLongPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      testID={`project-card-${item.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, { width: size + 16 }, pressed && { opacity: 0.7 }]}>
      <View style={styles.thumb}>
        <SheetThumb sheet={item.sheet} size={size} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.meta}>
        {shortDate(item.updatedAt)}
        {item.stage === 'setup' ? ' ・ 作成中' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 8, gap: 4 },
  thumb: { borderRadius: 8, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtext },
});
