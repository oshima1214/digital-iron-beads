// iOS: Skia はネイティブなので、読み込みを待つ必要はない。
export function loadSkia(): Promise<void> {
  return Promise.resolve();
}
