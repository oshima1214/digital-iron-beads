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

/**
 * iPad の画面配置。縦向きは 'stacked'（パネルが上）。横向きは、横にパネル（panelW）を置いてもプレートの幅が入るなら 'side'、
 * 入らなければ 'compact'（上に1行の薄いパネル。iPad mini の横向きなど）。
 */
export function chooseStageLayout(o: { winW: number; winH: number; cell: number; panelW: number; padding?: number; gap?: number }): 'side' | 'stacked' | 'compact' {
  if (o.winW <= o.winH) return 'stacked';
  const stageW = o.winW - (o.padding ?? 24) - (o.gap ?? 12) - o.panelW;
  return o.cell * PLATE_CELLS <= stageW ? 'side' : 'compact';
}

/** iPhone で実寸表示するのは 13×13 の作品だけ（約 65mm 四方。それより大きいと iPhone の画面に入らない） */
export const PHONE_PHYSICAL_SIZE = 13;

const PHONE_163 = new Set(['iPhone12,8', 'iPhone14,6', 'iPhone11,8', 'iPhone12,1']); // SE 第2・3世代、XR、11（326ppi @2x）
const PHONE_MINI = new Set(['iPhone13,1', 'iPhone14,4']); // 12 mini / 13 mini（476ppi @3x）

/** 機種ごとの本来の画面の幅（縦向き・pt）。設定の「画面表示の拡大」がオンだと、これより狭くなる */
const PHONE_NATIVE_WIDTH: Record<string, number> = {
  'iPhone11,8': 414, 'iPhone12,1': 414, 'iPhone12,3': 375, 'iPhone12,5': 414, 'iPhone12,8': 375, 'iPhone14,6': 375,
  'iPhone13,1': 375, 'iPhone14,4': 375,
  'iPhone13,2': 390, 'iPhone13,3': 390, 'iPhone13,4': 428,
  'iPhone14,5': 390, 'iPhone14,2': 390, 'iPhone14,3': 428,
  'iPhone14,7': 390, 'iPhone14,8': 428, 'iPhone15,2': 393, 'iPhone15,3': 430,
  'iPhone15,4': 393, 'iPhone15,5': 430, 'iPhone16,1': 393, 'iPhone16,2': 430,
  'iPhone17,3': 393, 'iPhone17,4': 430, 'iPhone17,1': 402, 'iPhone17,2': 440, 'iPhone17,5': 390,
  'iPhone18,3': 402, 'iPhone18,1': 402, 'iPhone18,2': 440, 'iPhone18,4': 420,
};

/**
 * iPhone のポイント密度（pt/inch）。表にない機種は、いまの多くの iPhone と同じ 460ppi @3x とする。
 * screenWidthPt（今の画面の短い辺）が本来の幅より狭いとき（画面表示の拡大）は、その比だけ pt を細かくする。
 */
export function phonePtPerInch(modelId: string | null, screenWidthPt?: number): number {
  const base = modelId && PHONE_163.has(modelId) ? 163 : modelId && PHONE_MINI.has(modelId) ? 476 / 3 : 460 / 3;
  const native = modelId ? PHONE_NATIVE_WIDTH[modelId] : undefined;
  return native && screenWidthPt && screenWidthPt > 0 ? base * (native / screenWidthPt) : base;
}

/**
 * iPhone の実寸表示（ほかの値から決まる。保存しない）。
 * off = 対象外（iPad・13×13 以外・まだ大きさが測れていない）、exact = 実寸で描く、too-small = 画面に入らない（注意書きを出す）
 */
export type PhonePhysical = 'off' | 'exact' | 'too-small';

export function phonePhysical(o: { phoneCell: number | null; sheetW: number; sheetH: number; boxW: number; boxH: number }): PhonePhysical {
  if (!o.phoneCell || o.sheetW !== PHONE_PHYSICAL_SIZE || o.sheetH !== PHONE_PHYSICAL_SIZE || o.boxW <= 0 || o.boxH <= 0) return 'off';
  const size = o.phoneCell * PHONE_PHYSICAL_SIZE;
  return size <= o.boxW && size <= o.boxH ? 'exact' : 'too-small';
}
