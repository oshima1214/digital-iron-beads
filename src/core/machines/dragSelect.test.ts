import { allowsScroll, DRAG_IDLE, dragSelectStep, type DragSelectEvent, type DragSelectState } from './dragSelect';

const run = (owned: number[], events: DragSelectEvent[]) => {
  let state: DragSelectState = DRAG_IDLE;
  let list = owned;
  for (const e of events) {
    const r = dragSelectStep(state, list, e);
    state = r.state;
    list = r.owned;
  }
  return { state, owned: list };
};
const press = (bead: number | null, x = 0, y = 0): DragSelectEvent => ({ type: 'press', bead, x, y });
const move = (bead: number | null, x: number, y: number): DragSelectEvent => ({ type: 'move', bead, x, y });
const release: DragSelectEvent = { type: 'release' };

test('tap toggles one bead (on release)', () => {
  expect(run([1, 2], [press(3), release]).owned).toEqual([1, 2, 3]);
  expect(run([1, 2], [press(2), release]).owned).toEqual([1]);
  expect(run([1, 2], [press(3)]).owned).toEqual([1, 2]); // 離すまでは変えない
});

test('a small wobble is still a tap', () => {
  expect(run([], [press(3), move(3, 4, 3), release]).owned).toEqual([3]);
});

test('sliding sideways selects every bead crossed; starting on a selected bead removes', () => {
  expect(run([5], [press(1), move(1, 9, 0), move(2, 80, 2), move(5, 150, 1), move(3, 230, 3), release]).owned).toEqual([1, 2, 3, 5]);
  expect(run([1, 2, 3, 4], [press(2), move(3, 60, 0), move(9, 120, 0), release]).owned).toEqual([1, 4]);
});

test('sliding up or down is a scroll: nothing changes, and the scroll view may take over', () => {
  const r = run([1], [press(2), move(2, 2, 20), move(7, 3, 90), release]);
  expect(r.owned).toEqual([1]);
  let s: DragSelectState = DRAG_IDLE;
  s = dragSelectStep(s, [], press(2)).state;
  expect(allowsScroll(s)).toBe(true);
  s = dragSelectStep(s, [], move(2, 30, 1)).state;
  expect(allowsScroll(s)).toBe(false); // 横になぞっている間はスクロールさせない
});

test('cancel (taken over by scrolling) changes nothing for a pending tap', () => {
  expect(run([1], [press(2), { type: 'cancel' }, release]).owned).toEqual([1]);
});

test('gaps (null) do nothing', () => {
  expect(run([1], [press(null), move(2, 40, 0), release]).owned).toEqual([1]);
  expect(run([1], [press(2), move(null, 40, 0), move(3, 80, 0), release]).owned).toEqual([1, 2, 3]);
});
