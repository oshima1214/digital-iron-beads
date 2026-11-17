import { ALL32, ALL64, BASIC8, BASIC16, beadByIndex, beadsForSet, PALETTE, PERLER32, setOfBeads } from './perler';

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

describe('64 colors', () => {
  test('PALETTE has indices 1..64 unique; the first 32 are PERLER32 unchanged', () => {
    expect(PALETTE.map((b) => b.index)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
    expect(new Set(PALETTE.map((b) => b.code)).size).toBe(64);
    expect(PALETTE.slice(0, 32)).toEqual(PERLER32);
    expect(ALL64).toHaveLength(64);
  });

  test('official names (5033 is ピーチ) and codes of the added colors', () => {
    expect(PALETTE.find((b) => b.code === '5033')!.name).toBe('ピーチ');
    expect(PALETTE.find((b) => b.code === '80-15269K')!.name).toBe('レモン');
    expect(beadByIndex(64).group).toBe('more');
  });

  test('bead sets', () => {
    expect(BASIC8.map((i) => beadByIndex(i).name)).toEqual(['しろ', 'きいろ', 'あか', 'ピンク', 'あお', 'みずいろ', 'みどり', 'くろ']);
    expect(beadsForSet('8', [])).toEqual(BASIC8);
    expect(beadsForSet('16', [])).toEqual(BASIC16);
    expect(beadsForSet('32', [])).toEqual(ALL32);
    expect(beadsForSet('owned', [40, 3, 40, 99, 0])).toEqual([3, 40]);
    expect(beadsForSet('original', [1])).toEqual([]);
  });

  test('setOfBeads guesses the set from an old allowedBeads list', () => {
    expect(setOfBeads([...BASIC16])).toBe('16');
    expect(setOfBeads([...ALL32].reverse())).toBe('32');
    expect(setOfBeads([...BASIC8])).toBe('8');
    expect(setOfBeads([1, 2, 40])).toBe('owned');
  });
});
