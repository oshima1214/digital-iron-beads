import { BeadsError, packBeads } from '@/core/file/beads';
import { createProject } from '@/core/file/project';
import { createSheet } from '@/core/sheet/sheet';
import { defaultConvertSettings } from '@/core/convert/types';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { importBeads } from './importer';

const now = new Date('2026-11-11T00:00:00Z');

function file(withSource: boolean) {
  const p = createProject('ねこ', createSheet(13, 13), new Date('2026-11-01T00:00:00Z'));
  if (withSource) {
    p.stage = 'setup';
    p.source = { image: 'source.png', brightness: 0, contrast: 0, convert: defaultConvertSettings(13) };
  }
  return packBeads(p, withSource ? new Uint8Array([137, 80, 78, 71]) : null);
}

test('importBeads saves project and source', async () => {
  const repo = createMemoryRepo();
  const { id, stage } = await importBeads(repo, file(true), now);
  const p = await repo.load(id);
  expect(p.name).toBe('ねこ');
  expect(stage).toBe('setup');
  expect(repo.sourceUri(id, 'source.png')).toBe('data:image/png;base64,iVBORw==');
});

test('import twice gives two projects', async () => {
  const repo = createMemoryRepo();
  const bytes = file(false);
  await importBeads(repo, bytes, now);
  await importBeads(repo, bytes, now);
  expect(await repo.list()).toHaveLength(2);
});

test('bad file throws BeadsError and saves nothing', async () => {
  const repo = createMemoryRepo();
  await expect(importBeads(repo, new Uint8Array([1, 2, 3]), now)).rejects.toBeInstanceOf(BeadsError);
  expect(await repo.list()).toEqual([]);
});
