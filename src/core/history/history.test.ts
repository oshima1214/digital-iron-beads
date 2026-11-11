import { applyChanges, paintCells } from '../sheet/ops';
import { createSheet } from '../sheet/sheet';
import { History } from './history';

function paint(h: History, s: ReturnType<typeof createSheet>, x: number, v: number) {
  const ch = paintCells(s, [[x, 0]], v);
  applyChanges(s, ch, 'forward');
  h.push(ch);
}

test('undo/redo restores cells', () => {
  const s = createSheet(2, 1);
  const h = new History();
  paint(h, s, 0, 5);
  paint(h, s, 1, 6);
  expect(h.undo(s)).toBe(true);
  expect([...s.cells]).toEqual([5, 0]);
  expect(h.undo(s)).toBe(true);
  expect([...s.cells]).toEqual([0, 0]);
  expect(h.undo(s)).toBe(false);
  expect(h.redo(s)).toBe(true);
  expect([...s.cells]).toEqual([5, 0]);
  expect(h.canRedo).toBe(true);
});

test('push after undo clears redo', () => {
  const s = createSheet(2, 1);
  const h = new History();
  paint(h, s, 0, 5);
  h.undo(s);
  paint(h, s, 1, 6);
  expect(h.canRedo).toBe(false);
  expect(h.redo(s)).toBe(false);
});

test('empty change set is ignored', () => {
  const h = new History();
  h.push([]);
  expect(h.canUndo).toBe(false);
});

test('limit 200 drops oldest', () => {
  const s = createSheet(1, 1);
  const h = new History();
  for (let k = 0; k < 201; k++) paint(h, s, 0, (k % 2) + 1);
  let n = 0;
  while (h.undo(s)) n++;
  expect(n).toBe(200);
});

test('clear empties both stacks', () => {
  const s = createSheet(1, 1);
  const h = new History();
  paint(h, s, 0, 1);
  h.undo(s);
  h.clear();
  expect(h.canUndo || h.canRedo).toBe(false);
});
