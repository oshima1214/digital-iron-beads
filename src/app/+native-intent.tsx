import { isBeadsUrl, setIncoming } from '@/state/incoming';

/** AirDrop などで .beads ファイルが開かれたら、画面の移動ではなく読み込みとして扱う（ホームで読み込む）。 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (isBeadsUrl(path)) {
      setIncoming(path);
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
