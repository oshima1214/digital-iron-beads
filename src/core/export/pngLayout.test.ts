import { PALETTE } from '../palette/perler';
import { createSheet } from '../sheet/sheet';
import { pngLayout } from './pngLayout';

const b = (code: string) => PALETTE.find((x) => x.code === code)!.index;

test('the sheet is on top and the bead list (name (code) count) is below, most used first', () => {
  const s = createSheet(13, 13);
  s.cells[0] = b('5005');
  s.cells[1] = b('5005');
  s.cells[2] = b('5018');
  const L = pngLayout(s, 24);
  expect(L.sheet).toEqual({ x: (L.width - 13 * 24) / 2, y: L.pad, size: 13 * 24 });
  expect(L.title.text).toBe('必要なビーズ　2色・3ビーズ');
  expect(L.title.y).toBeGreaterThan(L.sheet.y + L.sheet.size);
  expect(L.items.map((i) => [i.name, i.code, i.count])).toEqual([
    ['あか', '（5005）', '2ビーズ'],
    ['くろ', '（5018）', '1ビーズ'],
  ]);
  const last = L.items[L.items.length - 1];
  expect(last.y + L.rowH).toBeLessThanOrEqual(L.height);
});

test('a wide sheet puts the list in several columns; everything stays inside the image', () => {
  const s = createSheet(58, 58);
  for (let i = 0; i < 40; i++) s.cells[i] = (i % 40) + 1;
  const L = pngLayout(s, 24);
  expect(L.cols).toBeGreaterThan(1);
  for (const it of L.items) {
    expect(it.x + L.colW).toBeLessThanOrEqual(L.width - L.pad + 0.001);
    expect(it.y + L.rowH).toBeLessThanOrEqual(L.height);
  }
});

test('an empty sheet still has a title', () => {
  expect(pngLayout(createSheet(13, 13), 24).title.text).toBe('必要なビーズ　0色・0ビーズ');
});
