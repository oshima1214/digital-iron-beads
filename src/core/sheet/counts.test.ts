import { countBeads } from './counts';
import { platesOf } from './plates';
import { createSheet, idx } from './sheet';

test('countBeads counts white bead (V7 regression)', () => {
  const s = createSheet(3, 1);
  s.cells.set([1, 1, 18]); // 1 = 5001 しろ
  expect(countBeads(s)).toEqual([
    { index: 1, count: 2 },
    { index: 18, count: 1 },
  ]);
});

test('countBeads ties are ordered by index', () => {
  const s = createSheet(2, 1);
  s.cells.set([9, 3]);
  expect(countBeads(s).map((c) => c.index)).toEqual([3, 9]);
});

test('countBeads per plate and empty sheet', () => {
  expect(countBeads(createSheet(29, 29))).toEqual([]);
  const s = createSheet(58, 58);
  s.cells[idx(s, 30, 0)] = 3;
  const p = platesOf(s);
  expect(countBeads(s, p[0])).toEqual([]);
  expect(countBeads(s, p[1])).toEqual([{ index: 3, count: 1 }]);
});
