import { beadByIndex } from '../palette/perler';
import { countBeads } from '../sheet/counts';
import type { Sheet } from '../sheet/sheet';

/** PNG で共有する画像の配置：上にビーズシート、下に必要なビーズの一覧（色の丸・色名（品番）・数）。 */
export interface PngLayout {
  width: number;
  height: number;
  pad: number;
  sheet: { x: number; y: number; size: number };
  title: { text: string; x: number; y: number; size: number };
  cols: number;
  colW: number;
  rowH: number;
  /** 文字の大きさ（色名）。品番は少し小さく */
  textSize: number;
  items: { index: number; name: string; code: string; count: string; x: number; y: number }[];
}

/** 一覧の1列の幅（px）。これが入る数だけ列を並べる */
const COL_MIN_W = 320;
/** 一覧が読める大きさを保つため、画像の幅はこれより狭くしない */
const MIN_W = 640;

export function pngLayout(sheet: Sheet, cellPx: number): PngLayout {
  const pad = 32;
  const size = sheet.width * cellPx;
  const width = Math.max(size + pad * 2, MIN_W);
  const counts = countBeads(sheet);
  const total = counts.reduce((a, c) => a + c.count, 0);
  const titleSize = 26;
  const textSize = 20;
  const rowH = 36;
  const cols = Math.max(1, Math.floor((width - pad * 2) / COL_MIN_W));
  const colW = (width - pad * 2) / cols;
  const titleY = pad + size + pad;
  const listY = titleY + titleSize + 16;
  const rows = Math.ceil(counts.length / cols);
  const items = counts.map((c, i) => {
    const b = beadByIndex(c.index);
    // 上から下へ、列ごとに並べる（多い順に縦に読める）
    const col = Math.floor(i / Math.max(1, rows));
    const row = i % Math.max(1, rows);
    return { index: c.index, name: b.name, code: `（${b.code}）`, count: `${c.count}ビーズ`, x: pad + col * colW, y: listY + row * rowH };
  });
  return {
    width,
    height: listY + rows * rowH + pad,
    pad,
    sheet: { x: (width - size) / 2, y: pad, size },
    title: { text: `必要なビーズ　${counts.length}色・${total}ビーズ`, x: pad, y: titleY, size: titleSize },
    cols,
    colW,
    rowH,
    textSize,
    items,
  };
}
