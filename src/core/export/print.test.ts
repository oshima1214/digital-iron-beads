import { createSheet, idx } from '../sheet/sheet';
import { countsText } from './countsText';
import { buildPrintHtml } from './print';

const pages = (html: string) => (html.match(/<section class="page/g) ?? []).length;

test('print html 29 has 2 pages (1 plate + counts)', () => {
  const s = createSheet(29, 29);
  s.cells[0] = 3;
  expect(pages(buildPrintHtml(s, '作品'))).toBe(2);
});

test('print html 116 has 17 pages and 5mm cells', () => {
  const html = buildPrintHtml(createSheet(116, 116), '大きい');
  expect(pages(html)).toBe(17);
  expect(html).toContain('width="145mm" height="145mm" viewBox="0 0 29 29"');
  expect(html).toContain('size: A4 portrait');
  expect(html).toMatch(/100%/);
});

test('print html escapes the name', () => {
  expect(buildPrintHtml(createSheet(13, 13), '<b>&"')).toContain('&lt;b&gt;&amp;&quot;');
});

test('print html draws only beads inside the sheet for 13 on a 29 plate', () => {
  const s = createSheet(13, 13);
  s.cells[idx(s, 12, 12)] = 5;
  const html = buildPrintHtml(s, 'x');
  expect(html).toContain('<circle cx="12.5" cy="12.5" r="0.45"');
  expect(html).not.toContain('cx="13.5"');
});

test('countsText lists codes by count', () => {
  const s = createSheet(13, 13);
  s.cells.set([3, 3, 8]);
  expect(countsText('ねこ', s)).toBe('ねこ\n必要なビーズ（2色・3粒）\n5005 あか 2\n5018 くろ 1');
});
