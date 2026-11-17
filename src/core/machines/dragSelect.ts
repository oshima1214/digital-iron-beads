/**
 * 手持ちのビーズを選ぶ：タップで1色を切り替え、なぞるとまとめて選ぶ（外す）。
 *
 *   idle ──press（ビーズの上）──▶ painting(add)    最初のビーズが未選択なら「選ぶ」
 *                                 painting(remove) 最初のビーズが選択済みなら「外す」
 *   painting ──move（ビーズの上）──▶ painting（同じ向きで、通ったビーズに当てる）
 *   painting ──release──▶ idle
 *
 * ビーズのないところ（bead = null）の press / move は何もしない。
 */
export type DragSelectState = { phase: 'idle' } | { phase: 'painting'; mode: 'add' | 'remove' };

export type DragSelectEvent = { type: 'press'; bead: number | null } | { type: 'move'; bead: number | null } | { type: 'release' };

export const DRAG_IDLE: DragSelectState = { phase: 'idle' };

const apply = (owned: readonly number[], bead: number, mode: 'add' | 'remove'): number[] => {
  if (mode === 'add') return owned.includes(bead) ? [...owned] : [...owned, bead].sort((a, b) => a - b);
  return owned.filter((b) => b !== bead);
};

export function dragSelectStep(state: DragSelectState, owned: readonly number[], event: DragSelectEvent): { state: DragSelectState; owned: number[] } {
  switch (event.type) {
    case 'release':
      return { state: DRAG_IDLE, owned: [...owned] };
    case 'press': {
      if (event.bead === null) return { state, owned: [...owned] };
      const mode = owned.includes(event.bead) ? 'remove' : 'add';
      return { state: { phase: 'painting', mode }, owned: apply(owned, event.bead, mode) };
    }
    case 'move':
      if (state.phase !== 'painting' || event.bead === null) return { state, owned: [...owned] };
      return { state, owned: apply(owned, event.bead, state.mode) };
  }
}
