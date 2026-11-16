import type { Cell } from '@/core/sheet/ops';

/**
 * 範囲選択（編集画面の「範囲」スイッチ）の状態機械。
 *
 *   idle ──press──▶ dragging ──release（動かした）──▶ idle ＋ 確定
 *                      │
 *                      └─release（同じマス = タップ）──▶ anchored（1点目を覚えて2点目を待つ）
 *   anchored ──press──▶ closing ──release──▶ idle ＋ 確定（2点目は離すまでドラッグで動かせる）
 *   どの状態でも cancel ──▶ idle
 *
 * シートの外（cell = null）の press / move は無視する。
 */
export type RangeState =
  | { phase: 'idle' }
  | { phase: 'dragging'; from: Cell; to: Cell }
  | { phase: 'anchored'; at: Cell }
  | { phase: 'closing'; from: Cell; to: Cell };

export type RangeEvent = { type: 'press'; cell: Cell | null } | { type: 'move'; cell: Cell | null } | { type: 'release' } | { type: 'cancel' };

export interface RangeStep {
  state: RangeState;
  /** 選択に加える矩形の2つの角（確定したときだけ） */
  commit?: [Cell, Cell];
}

export const RANGE_IDLE: RangeState = { phase: 'idle' };

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export function rangeStep(state: RangeState, event: RangeEvent): RangeStep {
  switch (event.type) {
    case 'cancel':
      return { state: RANGE_IDLE };
    case 'press': {
      const c = event.cell;
      if (!c) return { state };
      if (state.phase === 'anchored') return { state: { phase: 'closing', from: state.at, to: c } };
      return { state: { phase: 'dragging', from: c, to: c } };
    }
    case 'move': {
      const c = event.cell;
      if (!c) return { state };
      switch (state.phase) {
        case 'idle':
          return { state };
        case 'anchored':
          return { state: { phase: 'dragging', from: state.at, to: c } };
        case 'dragging':
        case 'closing':
          return { state: { ...state, to: c } };
      }
      return { state };
    }
    case 'release':
      switch (state.phase) {
        case 'idle':
        case 'anchored':
          return { state };
        case 'dragging':
          if (same(state.from, state.to)) return { state: { phase: 'anchored', at: state.from } };
          return { state: RANGE_IDLE, commit: [state.from, state.to] };
        case 'closing':
          return { state: RANGE_IDLE, commit: [state.from, state.to] };
      }
  }
  return { state };
}

/** 画面に描く矩形（なければ null）。anchored は1点目のマスだけ。 */
export function rangeOf(state: RangeState): [Cell, Cell] | null {
  switch (state.phase) {
    case 'idle':
      return null;
    case 'anchored':
      return [state.at, state.at];
    case 'dragging':
    case 'closing':
      return [state.from, state.to];
  }
}
