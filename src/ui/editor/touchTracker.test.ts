import { createTouchTracker } from './touchTracker';

const P = (x: number, y: number) => ({ x, y });

describe('phone (zoom enabled)', () => {
  test('a pinch that starts with one finger never begins a tool action', () => {
    const tr = createTouchTracker(true);
    expect(tr.start(1, P(10, 10), 0)).toEqual([]);
    const a = tr.move([{ id: 1, p: P(10, 10) }, { id: 2, p: P(50, 50) }], 30);
    expect(a.map((x) => x.type)).toEqual(['pinchStart']);
    expect(tr.end(500)).toEqual([]);
  });

  test('holding still for 100ms begins the stroke at the start point', () => {
    const tr = createTouchTracker(true);
    tr.start(1, P(10, 10), 0);
    expect(tr.tick(50)).toEqual([]);
    expect(tr.tick(100)).toEqual([{ type: 'begin', p: P(10, 10) }]);
    expect(tr.move([{ id: 1, p: P(20, 10) }], 120)).toEqual([{ type: 'move', p: P(20, 10) }]);
    expect(tr.end(200)).toEqual([{ type: 'end' }]);
  });

  test('moving more than 6px begins immediately', () => {
    const tr = createTouchTracker(true);
    tr.start(1, P(10, 10), 0);
    expect(tr.move([{ id: 1, p: P(20, 10) }], 20)).toEqual([
      { type: 'begin', p: P(10, 10) },
      { type: 'move', p: P(20, 10) },
    ]);
  });

  test('a quick tap reports begin+end and tap at release', () => {
    const tr = createTouchTracker(true);
    tr.start(1, P(10, 10), 0);
    expect(tr.end(60)).toEqual([{ type: 'begin', p: P(10, 10) }, { type: 'end' }, { type: 'tap', p: P(10, 10) }]);
  });

  test('second finger during a stroke ends it, then pinches', () => {
    const tr = createTouchTracker(true);
    tr.start(1, P(10, 10), 0);
    tr.tick(100);
    const a = tr.move([{ id: 1, p: P(12, 10) }, { id: 2, p: P(60, 60) }], 150);
    expect(a.map((x) => x.type)).toEqual(['end', 'pinchStart']);
  });

  test('double tap resets zoom instead of a second tap', () => {
    const tr = createTouchTracker(true);
    tr.start(1, P(10, 10), 0);
    tr.end(50);
    tr.start(1, P(12, 11), 200);
    expect(tr.end(250)).toEqual([{ type: 'resetZoom' }]);
  });
});

describe('tablet / web (no zoom)', () => {
  test('begins immediately', () => {
    const tr = createTouchTracker(false);
    expect(tr.start(1, P(5, 5), 0)).toEqual([{ type: 'begin', p: P(5, 5) }]);
  });

  test('ignores other fingers and ends when the drawing finger disappears', () => {
    const tr = createTouchTracker(false);
    tr.start(1, P(5, 5), 0);
    expect(tr.move([{ id: 1, p: P(9, 5) }, { id: 2, p: P(200, 200) }], 10)).toEqual([{ type: 'move', p: P(9, 5) }]);
    expect(tr.move([{ id: 2, p: P(210, 200) }], 20)).toEqual([{ type: 'end' }]);
    expect(tr.move([{ id: 2, p: P(220, 200) }], 30)).toEqual([]);
    expect(tr.end(40)).toEqual([]);
  });
});
