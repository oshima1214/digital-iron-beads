// Web（自動テスト用）: ブラウザ標準のダイアログ。
export async function showMenu(title: string, options: string[]): Promise<number | null> {
  const answer = window.prompt(`${title}\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`, '');
  const n = Number(answer);
  return Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : null;
}

export async function confirmDestructive(title: string, message: string): Promise<boolean> {
  return window.confirm(`${title}\n${message}`);
}

export async function promptText(title: string, initial: string): Promise<string | null> {
  return window.prompt(title, initial);
}

export function notify(title: string, message: string): void {
  window.alert(`${title}\n${message}`);
}
