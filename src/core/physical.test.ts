import { cellPt, chooseStageLayout, fitPlate, halfRows, ptPerInchFor } from './physical';

test('132pt/inch iPad → cell 25.98pt', () => {
  expect(cellPt(132, 1)).toBeCloseTo(25.984, 2);
  expect(cellPt(132, 1.01)).toBeCloseTo(26.244, 2);
});

test('mini ids → 163 and known', () => {
  for (const id of ['iPad5,1', 'iPad11,2', 'iPad14,1', 'iPad16,2']) expect(ptPerInchFor(id, 'iPad mini', false)).toEqual({ ptPerInch: 163, known: true });
  expect(ptPerInchFor('iPad13,4', 'iPad Pro', false)).toEqual({ ptPerInch: 132, known: true });
});

test('unknown model falls back by name', () => {
  expect(ptPerInchFor('iPad99,1', 'iPad mini (A99)', false)).toEqual({ ptPerInch: 163, known: false });
  expect(ptPerInchFor(null, 'iPad mini (A99)', false)).toEqual({ ptPerInch: 163, known: false });
  expect(ptPerInchFor(null, 'iPad Pro (M9)', false)).toEqual({ ptPerInch: 132, known: false });
  expect(ptPerInchFor(null, null, false)).toEqual({ ptPerInch: 132, known: false });
});

test('web → 96', () => {
  expect(ptPerInchFor(null, null, true)).toEqual({ ptPerInch: 96, known: true });
});

test('fitPlate on 11-inch portrait → full', () => {
  expect(fitPlate(cellPt(132, 1), 834, 800)).toEqual({ fits: 'full', rows: 29 }); // 753.5pt 角
});

test('fitPlate on mini landscape → half', () => {
  const r = fitPlate(cellPt(163, 1), 950, 700); // 930.6pt 幅・高さ不足
  expect(r.fits).toBe('half');
  expect(r.rows).toBeGreaterThanOrEqual(15);
  expect(r.rows).toBeLessThan(29);
});

test('fitPlate on mini portrait → none', () => {
  expect(fitPlate(cellPt(163, 1), 744, 900).fits).toBe('none');
});

test('halfRows', () => {
  expect(halfRows(0, 21)).toEqual([0, 21]);
  expect(halfRows(1, 21)).toEqual([8, 29]);
  expect(halfRows(1, 29)).toEqual([0, 29]);
});

test('chooseStageLayout: side panel only when the plate still fits beside it', () => {
  // 11インチ横向き 1194×834（132pt/inch、プレート 753.5pt）
  expect(chooseStageLayout({ winW: 1194, winH: 834, cell: cellPt(132, 1), panelW: 360 })).toBe('side');
  // iPad mini 横向き 1133×744（163pt/inch、プレート 930.6pt）：横に置くと入らない → 上に薄いパネル
  expect(chooseStageLayout({ winW: 1133, winH: 744, cell: cellPt(163, 1), panelW: 360 })).toBe('compact');
  // 縦向きは常にパネルが上
  expect(chooseStageLayout({ winW: 834, winH: 1194, cell: cellPt(132, 1), panelW: 360 })).toBe('stacked');
});

test('fitPlate with the real iPad mini landscape stage (compact panel) → half', () => {
  // 1133 − 余白 24 = 1109 幅、744 − 安全領域 44 − 薄いパネル 64 − 余白 16 = 620 高さ
  const r = fitPlate(cellPt(163, 1), 1109, 620);
  expect(r.fits).toBe('half');
  expect(r.rows).toBeGreaterThanOrEqual(15);
});
