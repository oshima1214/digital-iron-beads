import { editorMode, navPhase, screenForStage } from './phases';

test('navPhase', () => {
  expect(navPhase(0, false)).toBe('empty');
  expect(navPhase(0, true)).toBe('empty');
  expect(navPhase(3, false)).toBe('placing');
  expect(navPhase(3, true)).toBe('done');
});
test('editorMode: melted preview is view-only whatever the tool', () => {
  for (const t of ['pen', 'eraser', 'bucket', 'select'] as const) expect(editorMode(t, true)).toBe('viewing');
  expect(editorMode('pen', false)).toBe('brush');
  expect(editorMode('eraser', false)).toBe('brush');
  expect(editorMode('bucket', false)).toBe('bucket');
  expect(editorMode('select', false)).toBe('select');
});
test('screenForStage', () => {
  expect(screenForStage('setup')).toBe('/new/convert');
  expect(screenForStage('edit')).toBe('/project/[id]');
});
