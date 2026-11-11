interface AppStateLike {
  addEventListener(type: 'change', handler: (state: string) => void): { remove(): void };
}

/** アプリがアクティブでなくなったら（バックグラウンド・切り替え中）すぐ保存する。仕様書 §4.2。 */
export function flushOnBackground(appState: AppStateLike, flush: () => Promise<void>): { remove(): void } {
  return appState.addEventListener('change', (s) => {
    if (s !== 'active') void flush().catch((e) => console.warn('autosave flush failed', e));
  });
}
