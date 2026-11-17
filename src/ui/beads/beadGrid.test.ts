import { FAMILIES, PALETTE } from '@/core/palette/perler';

import { beadAt, beadGridLayout } from './beadGrid';

test('every bead gets a cell; families start on a new row; nothing overflows the width', () => {
  const g = beadGridLayout(300);
  expect(g.cells).toHaveLength(64);
  expect(new Set(g.cells.map((c) => c.index)).size).toBe(64);
  for (const c of g.cells) expect(c.x + g.size).toBeLessThanOrEqual(300);
  const firstOf = (fam: string) => g.cells.find((c) => PALETTE[c.index - 1].family === fam)!;
  for (let i = 1; i < FAMILIES.length; i++) expect(firstOf(FAMILIES[i].id).y).toBeGreaterThan(firstOf(FAMILIES[i - 1].id).y);
  expect(g.rows.map((r) => r.family)).toEqual(FAMILIES.map((f) => f.id));
  expect(g.height).toBeGreaterThan(0);
});

test('beadAt finds the bead under a point and null in the gaps', () => {
  const g = beadGridLayout(300);
  const c = g.cells[10];
  expect(beadAt(g, c.x + 2, c.y + 2)).toBe(c.index);
  expect(beadAt(g, c.x + g.size + g.gap / 2, c.y + 2)).toBeNull();
  expect(beadAt(g, -5, 0)).toBeNull();
});
