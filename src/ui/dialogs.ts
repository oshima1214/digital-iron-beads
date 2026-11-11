// iOS: 標準のアクションシートとダイアログ。
import { ActionSheetIOS, Alert } from 'react-native';

export function showMenu(title: string, options: string[], destructiveIndex?: number): Promise<number | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options, 'キャンセル'], cancelButtonIndex: options.length, destructiveButtonIndex: destructiveIndex },
      (i) => resolve(i === options.length ? null : i),
    );
  });
}

export function confirmDestructive(title: string, message: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function promptText(title: string, initial: string): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      undefined,
      [
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(null) },
        { text: 'OK', onPress: (v?: string) => resolve(v ?? null) },
      ],
      'plain-text',
      initial,
    );
  });
}

export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}
