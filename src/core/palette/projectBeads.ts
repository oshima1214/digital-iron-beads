import type { Project } from '../file/project';
import { ALL64, PALETTE } from './perler';

/**
 * 編集画面で選べる色：作品を作ったときの使うビーズ（16色なら16色、2色ならその2色）。
 * 写真から作っていない作品（文字・白紙・元の写真のない .beads）は 64色。
 * すでにシートにある色は、組み合わせの外でも選べるように足す。番号順。
 */
export function editorPalette(p: Project): number[] {
  const set = new Set(baseBeads(p));
  for (const v of p.sheet.cells) if (v) set.add(v);
  return [...set].sort((a, b) => a - b);
}

function baseBeads(p: Project): readonly number[] {
  const c = p.source?.convert;
  if (!c) return ALL64;
  if (c.preset === 'twoColor' && c.twoColor) return [c.twoColor.dark, c.twoColor.light];
  if (c.beadSet === 'original' || c.allowedBeads.length === 0) return ALL64;
  return c.allowedBeads.filter((i) => i >= 1 && i <= PALETTE.length);
}

/** ホームの作品カードに出す「何色で作ったか」 */
export function beadSetLabel(p: Project): string {
  const c = p.source?.convert;
  if (!c) return '64色';
  if (c.preset === 'twoColor') return '2色';
  switch (c.beadSet) {
    case '8':
    case '16':
    case '32':
      return `${c.beadSet}色`;
    case 'owned':
      return `手持ち${c.allowedBeads.length}色`;
    case 'original':
      return '元の色'; // ビーズシート作成の途中
  }
}
