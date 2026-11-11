/** 外から開かれた .beads ファイルの URI（AirDrop・「このアプリで開く」）。ホーム画面が受け取って読み込む。 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function setIncoming(uri: string): void {
  pending = uri;
  for (const l of listeners) l();
}

export function takeIncoming(): string | null {
  const u = pending;
  pending = null;
  return u;
}

export function onIncoming(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** .beads ファイルの URL か（file:// で拡張子 .beads） */
export function isBeadsUrl(path: string): boolean {
  return /^file:/i.test(path) && /\.beads(\?|#|$)/i.test(path);
}
