/**
 * 手持ちのビーズを選ぶ：タップで1色を切り替え、横になぞるとまとめて選ぶ（外す）。縦に動かすと画面のスクロール。
 *
 *   idle ──press（ビーズの上）──▶ pending（まだ何も変えない）
 *   pending ──横に SLIDE_PX 以上──▶ painting(add / remove)  最初のビーズが未選択なら「選ぶ」、選択済みなら「外す」
 *   pending ──縦に SLIDE_PX 以上──▶ scrolling（何も変えない）
 *   pending ──release──▶ idle ＋ 最初のビーズを切り替える（タップ）
 *   painting ──move（ビーズの上）──▶ painting（同じ向きで、通ったビーズに当てる）
 *   painting / scrolling ──release──▶ idle
 *   どの状態でも cancel（スクロールに取られた）──▶ idle（pending なら何も変えない）
 */
export type DragSelectState =
  | { phase: 'idle' }
  | { phase: 'pending'; bead: number; x: number; y: number }
  | { phase: 'painting'; mode: 'add' | 'remove' }
  | { phase: 'scrolling' };

export type DragSelectEvent =
  | { type: 'press'; bead: number | null; x: number; y: number }
  | { type: 'move'; bead: number | null; x: number; y: number }
  | { type: 'release' }
  | { type: 'cancel' };

export const DRAG_IDLE: DragSelectState = { phase: 'idle' };
/** これ以上動いたら、横ならなぞり、縦ならスクロール */
export const SLIDE_PX = 8;

const apply = (owned: readonly number[], bead: number, mode: 'add' | 'remove'): number[] => {
  if (mode === 'add') return owned.includes(bead) ? [...owned] : [...owned, bead].sort((a, b) => a - b);
  return owned.filter((b) => b !== bead);
};

/** スクロールに操作を渡してよいか（横になぞっている間はだめ） */
export const allowsScroll = (s: DragSelectState) => s.phase !== 'painting';

export function dragSelectStep(state: DragSelectState, owned: readonly number[], event: DragSelectEvent): { state: DragSelectState; owned: number[] } {
  const same = { state, owned: [...owned] };
  switch (event.type) {
    case 'cancel':
      return { state: DRAG_IDLE, owned: [...owned] };
    case 'release':
      if (state.phase === 'pending') return { state: DRAG_IDLE, owned: apply(owned, state.bead, owned.includes(state.bead) ? 'remove' : 'add') };
      return { state: DRAG_IDLE, owned: [...owned] };
    case 'press':
      return event.bead === null ? { state: DRAG_IDLE, owned: [...owned] } : { state: { phase: 'pending', bead: event.bead, x: event.x, y: event.y }, owned: [...owned] };
    case 'move':
      switch (state.phase) {
        case 'pending': {
          const dx = Math.abs(event.x - state.x);
          const dy = Math.abs(event.y - state.y);
          if (dx > SLIDE_PX && dx > dy * 1.5) {
            const mode = owned.includes(state.bead) ? 'remove' : 'add';
            let next = apply(owned, state.bead, mode);
            if (event.bead !== null) next = apply(next, event.bead, mode);
            return { state: { phase: 'painting', mode }, owned: next };
          }
          if (dy > SLIDE_PX) return { state: { phase: 'scrolling' }, owned: [...owned] };
          return same;
        }
        case 'painting':
          return event.bead === null ? same : { state, owned: apply(owned, event.bead, state.mode) };
        default:
          return same;
      }
  }
}
