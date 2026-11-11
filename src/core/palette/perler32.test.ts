import { ALL32, BASIC16, beadByIndex, PERLER32 } from './perler32';

test('PERLER32 has indices 1..32 unique and codes unique', () => {
  expect(PERLER32.map((b) => b.index)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  expect(new Set(PERLER32.map((b) => b.code)).size).toBe(32);
});

test('white bead is 5001 (255,255,255) and basic', () => {
  const w = PERLER32.find((b) => b.code === '5001')!;
  expect(w.rgb).toEqual([255, 255, 255]);
  expect(w.group).toBe('basic');
  expect(w.name).toBe('しろ');
});

test('BASIC16 has 16 entries and ALL32 has 32', () => {
  expect(BASIC16).toHaveLength(16);
  expect(ALL32).toHaveLength(32);
});

test('beadByIndex returns the bead and throws on 0', () => {
  expect(beadByIndex(1).code).toBe('5001');
  expect(() => beadByIndex(0)).toThrow();
});
