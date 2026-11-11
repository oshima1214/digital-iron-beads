/**
 * 編集キャンバスのタッチの解釈（純粋なロジック。PanResponder から呼ぶ）。
 * - iPhone（ズームあり）: 指を置いてもすぐには塗らない。100ms 静止するか 6px 動いたら開始。
 *   その前に2本目の指が来たらピンチとして扱い、何も塗らない。ダブルタップでズームを戻す。
 * - iPad・Web（ズームなし）: すぐに開始する。最初に置いた指だけを追い、ほかの指は無視する。
 */
export interface Pt {
  x: number;
  y: number;
}

export type TouchAction =
  | { type: 'begin'; p: Pt }
  | { type: 'move'; p: Pt }
  | { type: 'end' }
  | { type: 'tap'; p: Pt }
  | { type: 'pinchStart'; a: Pt; b: Pt }
  | { type: 'pinch'; a: Pt; b: Pt }
  | { type: 'resetZoom' };

export interface TouchPoint {
  id: number;
  p: Pt;
}

export const HOLD_MS = 100;
export const MOVE_PX = 6;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 20;

type State = 'idle' | 'pending' | 'tool' | 'pinch' | 'ignore';

export function createTouchTracker(canZoom: boolean) {
  let state: State = 'idle';
  let primary = -1;
  let startP: Pt = { x: 0, y: 0 };
  let startT = 0;
  let moved = false;
  let pinchFingers = 0;
  let lastTap: { t: number; p: Pt } | null = null;
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

  return {
    start(id: number, p: Pt, t: number): TouchAction[] {
      primary = id;
      startP = p;
      startT = t;
      moved = false;
      if (canZoom) {
        state = 'pending';
        return [];
      }
      state = 'tool';
      return [{ type: 'begin', p }];
    },

    /** 指を置いたまま動かさないときに、一定間隔で呼ぶ。 */
    tick(t: number): TouchAction[] {
      if (state === 'pending' && t - startT >= HOLD_MS) {
        state = 'tool';
        return [{ type: 'begin', p: startP }];
      }
      return [];
    },

    move(touches: TouchPoint[], t: number): TouchAction[] {
      if (canZoom && touches.length >= 2) {
        const a = touches[0].p;
        const b = touches[1].p;
        const out: TouchAction[] = [];
        if (state === 'tool') out.push({ type: 'end' });
        if (state !== 'pinch' || pinchFingers < 2) out.push({ type: 'pinchStart', a, b });
        else out.push({ type: 'pinch', a, b });
        state = 'pinch';
        pinchFingers = 2;
        return out;
      }
      if (state === 'pinch') {
        pinchFingers = touches.length;
        return [];
      }
      const me = touches.find((x) => x.id === primary);
      if (!me) {
        // 描いていた指が離れ、別の指だけが残った：線をつなげずに終える
        if (state === 'tool') {
          state = 'ignore';
          return [{ type: 'end' }];
        }
        if (state === 'pending') state = 'ignore';
        return [];
      }
      if (state === 'pending') {
        if (dist(me.p, startP) > MOVE_PX || t - startT >= HOLD_MS) {
          state = 'tool';
          moved = true;
          return [{ type: 'begin', p: startP }, { type: 'move', p: me.p }];
        }
        return [];
      }
      if (state === 'tool') {
        if (dist(me.p, startP) > MOVE_PX) moved = true;
        return [{ type: 'move', p: me.p }];
      }
      return [];
    },

    end(t: number): TouchAction[] {
      const was = state;
      state = 'idle';
      pinchFingers = 0;
      if (was === 'pinch' || was === 'ignore' || was === 'idle') return [];
      const isTap = !moved;
      if (canZoom && isTap) {
        if (lastTap && t - lastTap.t < DOUBLE_TAP_MS && dist(lastTap.p, startP) < DOUBLE_TAP_PX) {
          lastTap = null;
          // 2回目のタップはズームを戻すだけ（2回目では塗らない）
          return was === 'tool' ? [{ type: 'end' }, { type: 'resetZoom' }] : [{ type: 'resetZoom' }];
        }
        lastTap = { t, p: startP };
      }
      const out: TouchAction[] = [];
      if (was === 'pending') out.push({ type: 'begin', p: startP });
      out.push({ type: 'end' });
      if (isTap) out.push({ type: 'tap', p: startP });
      return out;
    },
  };
}
