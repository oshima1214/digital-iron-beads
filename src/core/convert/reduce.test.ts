import { PERLER32 } from '../palette/perler32';
import { reduceColors } from './reduce';

const b = (code: string) => PERLER32.find((x) => x.code === code)!.index;

test('reduceColors merges least-used into nearest remaining', () => {
  const cells = new Uint8Array([...Array(10).fill(b('5005')), ...Array(10).fill(b('5018')), b('5059')]);
  reduceColors(cells, 2);
  expect(cells[20]).toBe(b('5005'));
  expect(new Set(cells)).toEqual(new Set([b('5005'), b('5018')]));
});

test('reduceColors: maxColors above used count is no-op', () => {
  const cells = new Uint8Array([3, 3, 8]);
  reduceColors(cells, 5);
  expect([...cells]).toEqual([3, 3, 8]);
});

test('reduceColors keeps 0 untouched', () => {
  const cells = new Uint8Array([0, 3, 3, 8, 0]);
  reduceColors(cells, 1);
  expect([...cells]).toEqual([0, 3, 3, 3, 0]);
});
