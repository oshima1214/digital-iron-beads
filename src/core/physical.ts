/** 実寸表示の計算（仕様書 §6.3）。1マス = 5mm、1プレート = 29マス = 145mm。 */
export const CELL_MM = 5;
export const PLATE_CELLS = 29;
export const MIN_HALF_ROWS = 15;

const MINI_IDS = new Set(['iPad5,1', 'iPad5,2', 'iPad11,1', 'iPad11,2', 'iPad14,1', 'iPad14,2', 'iPad16,1', 'iPad16,2']);

/**
 * 機種ごとのポイント密度（pt/inch）。iPad mini は 163、そのほかの iPad は 132、Web（自動テスト用）は CSS の 96。
 * known=false は推測した値（初めての実寸表示で微調整画面へ誘導する）。
 */
export function ptPerInchFor(modelId: string | null, modelName: string | null, isWeb: boolean): { ptPerInch: number; known: boolean } {
  if (isWeb) return { ptPerInch: 96, known: true };
  const nameSaysMini = !!modelName && /mini/i.test(modelName);
  if (modelId && MINI_IDS.has(modelId)) return { ptPerInch: 163, known: true };
  if (modelId?.startsWith('iPad') && !nameSaysMini) return { ptPerInch: 132, known: true };
  return { ptPerInch: nameSaysMini ? 163 : 132, known: false };
}

/** 1マスのポイント数 = 5mm ÷ 25.4 × ptPerInch × 補正係数 */
export function cellPt(ptPerInch: number, factor: number): number {
  return (CELL_MM / 25.4) * ptPerInch * factor;
}

/** 1プレートが箱に収まるか。幅が収まり 15 行以上入るなら half（rows = 入る行数）。 */
export function fitPlate(cell: number, boxW: number, boxH: number): { fits: 'full' | 'half' | 'none'; rows: number } {
  const size = cell * PLATE_CELLS;
  if (size <= boxW && size <= boxH) return { fits: 'full', rows: PLATE_CELLS };
  const rows = Math.min(PLATE_CELLS, Math.floor(boxH / cell));
  if (size <= boxW && rows >= MIN_HALF_ROWS) return { fits: 'half', rows };
  return { fits: 'none', rows: 0 };
}

/** 半分表示の行の範囲 [開始, 終了)。上半分は 0..rows、下半分は 29-rows..29。 */
export function halfRows(part: 0 | 1, rows: number): [number, number] {
  return part === 0 ? [0, rows] : [PLATE_CELLS - rows, PLATE_CELLS];
}
