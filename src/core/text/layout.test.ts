import { idx } from '../sheet/sheet';
import { isHalfWidth, maskToCells, placeText, textKey, textLayout, textLimitMessage } from './layout';

test('isHalfWidth', () => {
  expect(isHalfWidth('A')).toBe(true);
  expect(isHalfWidth('ｱ')).toBe(true);
  expect(isHalfWidth('あ')).toBe(false);
});

test('29: 2 full chars fit, 3 do not', () => {
  const two = textLayout('あい', 29);
  expect(two).toMatchObject({ charH: 14, widths: [14, 14], totalW: 28, fits: true });
  expect(textLayout('あいう', 29).fits).toBe(false);
});

test('29: 4 half chars fit', () => {
  expect(textLayout('kiyo', 29)).toMatchObject({ widths: [7, 7, 7, 7], totalW: 28, fits: true });
  expect(textLayout('kiyoe', 29).fits).toBe(false);
});

test('58 doubles char height', () => {
  expect(textLayout('あ', 58)).toMatchObject({ charH: 28, widths: [28] });
});

test('fits rejects too many chars and empty text', () => {
  expect(textLayout('', 29).fits).toBe(false);
  expect(textLayout('あいう', 29).fits).toBe(false);
});

test('maskToCells threshold', () => {
  // 2x1 マス、1マス 2px。左のマスは 3/4 が文字、右は 1/4
  const mask = new Uint8Array([255, 255, 255, 0, 255, 0, 0, 0]);
  // 行優先 4x2 px: 行0 = [255,255 | 255,0], 行1 = [255,0 | 0,0] → 左 3/4、右 1/4
  expect([...maskToCells(mask, 4, 2, 2, 8, 0)]).toEqual([8, 0]);
  expect([...maskToCells(mask, 4, 2, 2, 8, 1, 0.2)]).toEqual([8, 8]);
});

test('placeText centres the block on the sheet', () => {
  const cells = new Uint8Array(4).fill(5); // 2x2
  const s = placeText(cells, 2, 2, 13);
  expect(s.width).toBe(13);
  expect(s.cells[idx(s, 5, 5)]).toBe(5);
  expect(s.cells[idx(s, 6, 6)]).toBe(5);
  expect(s.cells[idx(s, 4, 4)]).toBe(0);
});

test('textLimitMessage explains the limit only when the text does not fit', () => {
  expect(textLimitMessage(textLayout('ひろと', 29))).toBe('入りません（全角2文字・半角4文字まで）');
  expect(textLimitMessage(textLayout('あい', 29))).toBeNull();
  expect(textLimitMessage(textLayout('', 29))).toBeNull();
});

test('textKey changes when any input changes', () => {
  const k = textKey({ text: 'AB', size: 29, fg: 8, bg: 0 });
  expect(textKey({ text: 'AB', size: 29, fg: 8, bg: 0 })).toBe(k);
  expect(textKey({ text: 'ABC', size: 29, fg: 8, bg: 0 })).not.toBe(k);
  expect(textKey({ text: 'AB', size: 58, fg: 8, bg: 0 })).not.toBe(k);
  expect(textKey({ text: 'AB', size: 29, fg: 8, bg: 1 })).not.toBe(k);
});
