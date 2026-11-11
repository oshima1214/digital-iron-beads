import { strToU8, zipSync } from 'fflate';

import { defaultConvertSettings } from '../convert/types';
import { createSheet, idx } from '../sheet/sheet';
import { BeadsError, packBeads, unpackBeads } from './beads';
import { createProject, serializeProject } from './project';

const T0 = new Date('2026-11-10T00:00:00Z');
const T1 = new Date('2026-11-11T00:00:00Z');

function sample(withSource = true) {
  const sheet = createSheet(29, 29);
  sheet.cells[idx(sheet, 3, 4)] = 7;
  const p = createProject('ねこ', sheet, T0);
  p.stage = withSource ? 'setup' : 'edit';
  p.nav = { plateIndex: 0, colorIndex: 1 };
  if (withSource) p.source = { image: 'source.png', brightness: 0, contrast: 0, convert: defaultConvertSettings(29) };
  return p;
}

test('pack → unpack roundtrip keeps sheet, name, stage and source', () => {
  const p = sample();
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const r = unpackBeads(packBeads(p, png), T1);
  expect(r.project.name).toBe('ねこ');
  expect([...r.project.sheet.cells]).toEqual([...p.sheet.cells]);
  expect(r.project.stage).toBe('setup');
  expect([...r.sourcePng!]).toEqual([...png]);
  expect(r.project.nav).toBeUndefined();
  expect(r.project.updatedAt).toBe(T1.toISOString());
});

test('import assigns a new id', () => {
  const p = sample();
  const bytes = packBeads(p, null);
  const a = unpackBeads(bytes, T1).project.id;
  const b = unpackBeads(bytes, T1).project.id;
  expect(a).not.toBe(p.id);
  expect(a).not.toBe(b);
});

test('missing source becomes stage edit without source', () => {
  const r = unpackBeads(packBeads(sample(true), null), T1);
  expect(r.project.stage).toBe('edit');
  expect(r.project.source).toBeUndefined();
});

test('parseBeads rejects random bytes / zip without project.json / future version / broken project', () => {
  const reason = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      return e instanceof BeadsError ? e.reason : 'other';
    }
    return 'none';
  };
  expect(reason(() => unpackBeads(new Uint8Array([1, 2, 3, 4]), T1))).toBe('not-zip');
  expect(reason(() => unpackBeads(zipSync({ 'a.txt': strToU8('x') }), T1))).toBe('not-beads');
  const future = JSON.parse(serializeProject(sample(false)));
  future.formatVersion = 9;
  expect(reason(() => unpackBeads(zipSync({ 'project.json': strToU8(JSON.stringify(future)) }), T1))).toBe('future-version');
  expect(reason(() => unpackBeads(zipSync({ 'project.json': strToU8('{"broken":') }), T1))).toBe('bad-project');
});
