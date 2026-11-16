/**
 * 作品を開く画面（下ごしらえ・ビーズ化・編集・制作ナビ・書き出し）に共通の読み込み状態。
 *
 *   loading ──読めた──▶ ready
 *   loading ──失敗──▶ error（ホームに戻ると解ける）
 *   ready ──別の作品の id に変わった──▶ loading
 */
export type LoadStatus = 'loading' | 'ready' | 'error';

export interface LoadFacts {
  /** 画面が開こうとしている作品の id（URL から） */
  wanted: string | undefined;
  /** ストアに読み込まれている作品の id */
  loaded: string | undefined;
  /** 読み込みに失敗した */
  error: boolean;
  /** id のほかに必要なもの（元画像など）がそろっているか。省略時は true */
  complete?: boolean;
}

export function loadStatus({ wanted, loaded, error, complete = true }: LoadFacts): LoadStatus {
  if (error) return 'error';
  return !!wanted && loaded === wanted && complete ? 'ready' : 'loading';
}
