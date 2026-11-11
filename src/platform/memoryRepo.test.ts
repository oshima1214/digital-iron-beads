import { createProject } from '@/core/file/project';
import { createSheet } from '@/core/sheet/sheet';

import { createMemoryRepo } from './memoryRepo';

const at = (iso: string) => new Date(iso);

test('save → list → load roundtrip, newest first', async () => {
  const repo = createMemoryRepo();
  const a = createProject('A', createSheet(13, 13), at('2026-11-10T00:00:00Z'));
  const b = createProject('B', createSheet(29, 29), at('2026-11-11T00:00:00Z'));
  await repo.save(a);
  await repo.save(b);
  expect((await repo.list()).map((s) => s.name)).toEqual(['B', 'A']);
  expect((await repo.load(a.id)).sheet.width).toBe(13);
});

test('list skips corrupt entries', async () => {
  const repo = createMemoryRepo();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const ok = createProject('OK', createSheet(13, 13), at('2026-11-10T00:00:00Z'));
  await repo.save(ok);
  repo.corrupt('bad');
  expect((await repo.list()).map((s) => s.id)).toEqual([ok.id]);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test('remove deletes from list and load', async () => {
  const repo = createMemoryRepo();
  const p = createProject('X', createSheet(13, 13), at('2026-11-10T00:00:00Z'));
  await repo.save(p);
  await repo.remove(p.id);
  expect(await repo.list()).toEqual([]);
  await expect(repo.load(p.id)).rejects.toThrow();
});

test('saveSource returns a file name and sourceUri points at it', async () => {
  const repo = createMemoryRepo();
  const name = await repo.saveSource('id1', new Uint8Array([137, 80, 78, 71]));
  expect(name).toBe('source.png');
  expect(repo.sourceUri('id1', name)).toBe('data:image/png;base64,iVBORw==');
});
