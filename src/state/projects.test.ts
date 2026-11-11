import { defaultConvertSettings } from '@/core/convert/types';
import { createProject } from '@/core/file/project';
import { createSheet } from '@/core/sheet/sheet';
import { createMemoryRepo } from '@/platform/memoryRepo';

import { createProjectsStore } from './projects';

async function setup() {
  const repo = createMemoryRepo();
  const p = createProject('ねこ', createSheet(13, 13), new Date('2026-11-10T00:00:00Z'));
  await repo.save(p);
  const store = createProjectsStore(repo, () => new Date('2026-11-11T00:00:00Z'));
  await store.getState().refresh();
  return { repo, store, p };
}

test('refresh loads summaries', async () => {
  const { store } = await setup();
  expect(store.getState().items.map((i) => i.name)).toEqual(['ねこ']);
  expect(store.getState().loading).toBe(false);
});

test('duplicate creates a new id with 「のコピー」 and newest first', async () => {
  const { store, p } = await setup();
  await store.getState().duplicate(p.id);
  const items = store.getState().items;
  expect(items).toHaveLength(2);
  expect(items[0].name).toBe('ねこ のコピー');
  expect(items[0].id).not.toBe(p.id);
});

test('rename and remove are reflected in the list and the repo', async () => {
  const { store, repo, p } = await setup();
  await store.getState().rename(p.id, 'いぬ');
  expect(store.getState().items[0].name).toBe('いぬ');
  expect((await repo.load(p.id)).name).toBe('いぬ');
  await store.getState().remove(p.id);
  expect(store.getState().items).toEqual([]);
});

test('rename ignores blank names', async () => {
  const { store, p } = await setup();
  await store.getState().rename(p.id, '   ');
  expect(store.getState().items[0].name).toBe('ねこ');
});

test('duplicate copies the source image inside the repo and keeps the stage', async () => {
  const { store, repo, p } = await setup();
  await repo.saveSource(p.id, new Uint8Array([1, 2, 3]));
  await repo.save({ ...p, stage: 'setup', source: { image: 'source.png', brightness: 0, contrast: 0, convert: defaultConvertSettings(13) } });
  await store.getState().duplicate(p.id);
  const copy = store.getState().items.find((i) => i.id !== p.id)!;
  const loaded = await repo.load(copy.id);
  expect(loaded.stage).toBe('setup');
  expect(repo.sourceUri(copy.id, 'source.png')).toBe(repo.sourceUri(p.id, 'source.png'));
});

test('duplicate of a setup project whose source is missing becomes stage edit without source', async () => {
  const { store, repo, p } = await setup();
  await repo.save({ ...p, stage: 'setup', source: { image: 'source.png', brightness: 0, contrast: 0, convert: defaultConvertSettings(13) } });
  await store.getState().duplicate(p.id);
  const copy = await repo.load(store.getState().items.find((i) => i.id !== p.id)!.id);
  expect(copy.stage).toBe('edit');
  expect(copy.source).toBeUndefined();
});
