import { RANGE_IDLE, rangeOf, rangeStep, type RangeState } from './rangeSelect';

const run = (events: Parameters<typeof rangeStep>[1][], from: RangeState = RANGE_IDLE) => {
  let state = from;
  const commits: unknown[] = [];
  for (const e of events) {
    const r = rangeStep(state, e);
    state = r.state;
    if (r.commit) commits.push(r.commit);
  }
  return { state, commits };
};

test('drag: press → move → release commits the rectangle', () => {
  const { state, commits } = run([{ type: 'press', cell: [2, 2] }, { type: 'move', cell: [4, 3] }, { type: 'release' }]);
  expect(state).toEqual(RANGE_IDLE);
  expect(commits).toEqual([[[2, 2], [4, 3]]]);
});

test('two taps: first tap anchors, second tap commits', () => {
  const first = run([{ type: 'press', cell: [1, 1] }, { type: 'release' }]);
  expect(first.state).toEqual({ phase: 'anchored', at: [1, 1] });
  expect(first.commits).toEqual([]);
  expect(rangeOf(first.state)).toEqual([[1, 1], [1, 1]]);
  const second = run([{ type: 'press', cell: [3, 2] }, { type: 'release' }], first.state);
  expect(second.state).toEqual(RANGE_IDLE);
  expect(second.commits).toEqual([[[1, 1], [3, 2]]]);
});

test('second tap on the anchor itself commits a single cell', () => {
  const { commits } = run([{ type: 'press', cell: [1, 1] }, { type: 'release' }, { type: 'press', cell: [1, 1] }, { type: 'release' }]);
  expect(commits).toEqual([[[1, 1], [1, 1]]]);
});

test('second corner can be dragged before release', () => {
  const { commits } = run([{ type: 'press', cell: [1, 1] }, { type: 'release' }, { type: 'press', cell: [3, 2] }, { type: 'move', cell: [5, 5] }, { type: 'release' }]);
  expect(commits).toEqual([[[1, 1], [5, 5]]]);
});

test('dragging back to the start counts as a tap (anchors)', () => {
  const { state, commits } = run([{ type: 'press', cell: [2, 2] }, { type: 'move', cell: [3, 2] }, { type: 'move', cell: [2, 2] }, { type: 'release' }]);
  expect(state).toEqual({ phase: 'anchored', at: [2, 2] });
  expect(commits).toEqual([]);
});

test('outside the sheet (null) is ignored; anchor survives', () => {
  const anchored: RangeState = { phase: 'anchored', at: [1, 1] };
  expect(run([{ type: 'press', cell: null }, { type: 'release' }], anchored).state).toEqual(anchored);
  // 外から入ってきたら、1点目からのドラッグとして扱う
  const r = run([{ type: 'press', cell: null }, { type: 'move', cell: [4, 4] }, { type: 'release' }], anchored);
  expect(r.commits).toEqual([[[1, 1], [4, 4]]]);
  expect(run([{ type: 'move', cell: null }, { type: 'move', cell: [3, 3] }, { type: 'release' }]).state).toEqual(RANGE_IDLE);
});

test('cancel returns to idle from any phase', () => {
  for (const s of [RANGE_IDLE, { phase: 'anchored', at: [1, 1] }, { phase: 'dragging', from: [0, 0], to: [1, 1] }, { phase: 'closing', from: [0, 0], to: [1, 1] }] as RangeState[]) {
    expect(rangeStep(s, { type: 'cancel' })).toEqual({ state: RANGE_IDLE });
  }
});

test('rangeOf', () => {
  expect(rangeOf(RANGE_IDLE)).toBeNull();
  expect(rangeOf({ phase: 'dragging', from: [0, 0], to: [2, 1] })).toEqual([[0, 0], [2, 1]]);
  expect(rangeOf({ phase: 'closing', from: [0, 0], to: [2, 1] })).toEqual([[0, 0], [2, 1]]);
});
