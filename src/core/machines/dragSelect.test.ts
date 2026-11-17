import { DRAG_IDLE, dragSelectStep, type DragSelectState } from './dragSelect';

const run = (owned: number[], events: Parameters<typeof dragSelectStep>[2][]) => {
  let state: DragSelectState = DRAG_IDLE;
  let list = owned;
  for (const e of events) {
    const r = dragSelectStep(state, list, e);
    state = r.state;
    list = r.owned;
  }
  return { state, owned: list };
};

test('tap toggles one bead', () => {
  expect(run([1, 2], [{ type: 'press', bead: 3 }, { type: 'release' }]).owned).toEqual([1, 2, 3]);
  expect(run([1, 2], [{ type: 'press', bead: 2 }, { type: 'release' }]).owned).toEqual([1]);
});

test('dragging from an unselected bead selects every bead it crosses', () => {
  const r = run([5], [{ type: 'press', bead: 1 }, { type: 'move', bead: 2 }, { type: 'move', bead: 5 }, { type: 'move', bead: 3 }, { type: 'release' }]);
  expect(r.owned).toEqual([1, 2, 3, 5]);
  expect(r.state).toEqual(DRAG_IDLE);
});

test('dragging from a selected bead removes every bead it crosses', () => {
  expect(run([1, 2, 3, 4], [{ type: 'press', bead: 2 }, { type: 'move', bead: 3 }, { type: 'move', bead: 9 }, { type: 'release' }]).owned).toEqual([1, 4]);
});

test('gaps between beads (null) and presses outside do nothing', () => {
  expect(run([1], [{ type: 'press', bead: null }, { type: 'move', bead: 2 }, { type: 'release' }]).owned).toEqual([1]);
  expect(run([1], [{ type: 'press', bead: 2 }, { type: 'move', bead: null }, { type: 'move', bead: 3 }, { type: 'release' }]).owned).toEqual([1, 2, 3]);
});
