/** ほかの状態から決まる「今どの場面か」。画面はこれで出し分ける（条件の組み合わせを画面ごとに書かない）。 */

/**
 * 制作ナビの1枚のプレートの進み具合。
 *   empty（ビーズなし） / placing（色を順に置いている） / done（最後の色まで終わった）
 *   placing ──最後の色で「次へ」──▶ done ──「前へ」──▶ placing
 */
export type NavPhase = 'empty' | 'placing' | 'done';

export function navPhase(colorCount: number, done: boolean): NavPhase {
  if (colorCount === 0) return 'empty';
  return done ? 'done' : 'placing';
}

/**
 * 編集画面で今できる操作。パネルの上の段とシートのタッチはこれで決まる。
 *   viewing（完成イメージ：見るだけ） / brush（ペン・消しゴム） / bucket / select
 */
export type EditorMode = 'viewing' | 'brush' | 'bucket' | 'select';

export function editorMode(tool: 'pen' | 'eraser' | 'bucket' | 'select', melted: boolean): EditorMode {
  if (melted) return 'viewing';
  return tool === 'pen' || tool === 'eraser' ? 'brush' : tool;
}

/**
 * 作品の段階（Project.stage）と開く画面。
 *   setup（ビーズ化の途中）──「完了」──▶ edit（編集できる）
 */
export function screenForStage(stage: 'setup' | 'edit'): '/new/convert' | '/project/[id]' {
  return stage === 'setup' ? '/new/convert' : '/project/[id]';
}
