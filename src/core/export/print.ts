import { beadByIndex } from '../palette/perler32';
import { countBeads } from '../sheet/counts';
import { platesOf } from '../sheet/plates';
import { PLATE, type Sheet } from '../sheet/sheet';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgb = (i: number) => `rgb(${beadByIndex(i).rgb.join(',')})`;

/**
 * 印刷用 HTML（A4 縦）。1プレート = 1ページで、マスは 5mm の実寸（SVG 145mm 角、viewBox 29×29）。
 * 最後のページに必要数の表。印刷の倍率は 100% にするよう注記する。
 */
export function buildPrintHtml(sheet: Sheet, name: string): string {
  const plates = platesOf(sheet);
  const title = esc(name);
  const pages = plates.map((plate) => {
    const parts: string[] = [];
    for (let y = 0; y < PLATE; y++) {
      for (let x = 0; x < PLATE; x++) {
        const sx = plate.originX + x;
        const sy = plate.originY + y;
        if (sx >= sheet.width || sy >= sheet.height) continue; // プレートの外（13/21 の作品）は空ける
        const v = sheet.cells[sy * sheet.width + sx];
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (v === 0) parts.push(`<circle cx="${cx}" cy="${cy}" r="0.08" fill="#C7C7CC"/>`);
        else parts.push(`<circle cx="${cx}" cy="${cy}" r="0.45" fill="${rgb(v)}"${v === 1 ? ' stroke="#AEAEB2" stroke-width="0.04"' : ''}/>`);
      }
    }
    const legend = countBeads(sheet, plate)
      .map((c) => `<span class="lg"><i style="background:${rgb(c.index)}"></i>${beadByIndex(c.index).code} ${esc(beadByIndex(c.index).name)} ${c.count}</span>`)
      .join('');
    const label = plates.length > 1 ? ` ・ プレート ${plate.index + 1}/${plates.length}` : '';
    return `<section class="page"><h1>${title}${label}</h1>
<svg width="145mm" height="145mm" viewBox="0 0 29 29" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="29" height="29" fill="none" stroke="#AEAEB2" stroke-width="0.05"/>${parts.join('')}</svg>
<p class="note">印刷の倍率は「100%（実際のサイズ）」にしてください。プレート1枚＝145mm 角、1マス＝5mm です。</p>
<div class="legend">${legend}</div></section>`;
  });
  const counts = countBeads(sheet);
  const total = counts.reduce((a, c) => a + c.count, 0);
  const rows = counts
    .map((c) => `<tr><td><i style="background:${rgb(c.index)}"></i></td><td>${beadByIndex(c.index).code}</td><td>${esc(beadByIndex(c.index).name)}</td><td class="n">${c.count}</td></tr>`)
    .join('');
  pages.push(`<section class="page"><h1>${title} ・ 必要なビーズ（${counts.length}色・${total}粒）</h1><table>${rows}</table></section>`);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title><style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: -apple-system, 'Hiragino Sans', sans-serif; color: #111; margin: 0; }
.page { page-break-after: always; display: flex; flex-direction: column; align-items: center; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 14pt; margin: 0 0 6mm; }
.note { font-size: 9pt; color: #555; margin: 4mm 0; }
.legend { display: flex; flex-wrap: wrap; gap: 2mm 5mm; font-size: 9pt; max-width: 186mm; }
.lg, td { white-space: nowrap; }
i { display: inline-block; width: 3.5mm; height: 3.5mm; border-radius: 50%; border: 0.2mm solid #AEAEB2; margin-right: 1.5mm; vertical-align: -0.6mm; }
table { border-collapse: collapse; font-size: 11pt; } td { padding: 1.5mm 4mm; border-bottom: 0.2mm solid #ddd; } .n { text-align: right; font-weight: bold; }
</style></head><body>${pages.join('\n')}</body></html>`;
}
