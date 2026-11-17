import { beadAt, beadGridLayout } from './beadGrid';

test('beads are in number order (as before), centered, and never overflow', () => {
  const g = beadGridLayout(358);
  expect(g.cells.map((c) => c.index)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  for (const c of g.cells) expect(c.x + g.chipW).toBeLessThanOrEqual(358);
  const firstRow = g.cells.filter((c) => c.y === 0);
  expect(firstRow).toHaveLength(4); // 72px の札が 358px に4つ
  expect(firstRow[0].x).toBeCloseTo(358 - (firstRow[3].x + g.chipW), 5);
  expect(g.height).toBe(16 * 66 + 15 * 6);
});

test('beadAt finds the bead under a point and null in the gaps', () => {
  const g = beadGridLayout(358);
  const c = g.cells[10];
  expect(beadAt(g, c.x + 2, c.y + 2)).toBe(c.index);
  expect(beadAt(g, c.x + g.chipW + g.gap / 2, c.y + 2)).toBeNull();
  expect(beadAt(g, -5, 0)).toBeNull();
});
