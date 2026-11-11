import { Pressable, StyleSheet, Text, View } from 'react-native';

import { editorStore, type Tool, useEditor } from '@/state/editor';

import { showMenu } from '../dialogs';
import { colors, fonts } from '../theme';

const TOOLS: { tool: Tool; icon: string; label: string }[] = [
  { tool: 'pen', icon: '✏️', label: 'ペン' },
  { tool: 'eraser', icon: '🧽', label: '消しゴム' },
  { tool: 'bucket', icon: '🪣', label: 'バケツ' },
  { tool: 'select', icon: '⬚', label: '選択' },
];

export const TOOLBAR_HEIGHT = 56;

export function Toolbar({ disabled }: { disabled?: boolean }) {
  const tool = useEditor((s) => s.tool);
  const outline = async () => {
    const i = await showMenu('縁取り（今の色で外側を囲む）', ['太さ 1', '太さ 2']);
    if (i !== null) editorStore().getState().applyOutline(i === 0 ? 1 : 2);
  };
  const item = (key: string, icon: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      testID={`tool-${key}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.item, active && styles.active, disabled && { opacity: 0.4 }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.bar}>
      {TOOLS.map((t) => item(t.tool, t.icon, t.label, tool === t.tool, () => editorStore().getState().setTool(t.tool)))}
      {item('outline', '◎', '縁取り', false, () => void outline())}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: TOOLBAR_HEIGHT, flexDirection: 'row', gap: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  active: { backgroundColor: '#E5F0FF' },
  icon: { fontSize: 18 },
  label: { fontFamily: fonts.regular, fontSize: 11, color: colors.subtext },
  labelActive: { fontFamily: fonts.bold, color: colors.accent },
});
