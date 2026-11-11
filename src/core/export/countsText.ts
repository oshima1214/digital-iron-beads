import { beadByIndex } from '../palette/perler32';
import { countBeads } from '../sheet/counts';
import type { Sheet } from '../sheet/sheet';

/** 必要数のテキスト（買い物メモ・共有用）。 */
export function countsText(name: string, sheet: Sheet): string {
  const counts = countBeads(sheet);
  const total = counts.reduce((a, c) => a + c.count, 0);
  const lines = counts.map((c) => `${beadByIndex(c.index).code} ${beadByIndex(c.index).name} ${c.count}`);
  return [name, `必要なビーズ（${counts.length}色・${total}粒）`, ...lines].join('\n');
}
