import { defaultConvertSettings } from '../convert/types';
import { createSheet } from '../sheet/sheet';
import { createProject, newProjectId, parseProject, ProjectParseError, serializeProject } from './project';

const now = new Date('2026-11-11T10:00:00Z');

function sample() {
  const sheet = createSheet(29, 29);
  sheet.cells[0] = 1;
  sheet.cells[840] = 32;
  const p = createProject('作品 1', sheet, now);
  p.stage = 'setup';
  p.source = { image: 'source.png', crop: { x: 1, y: 2, w: 30, h: 40 }, brightness: 10, contrast: -5, convert: defaultConvertSettings(29) };
  return p;
}

function withField(patch: Record<string, unknown>) {
  return JSON.stringify({ ...JSON.parse(serializeProject(sample())), ...patch });
}

test('serialize → parse roundtrip keeps cells and source', () => {
  const p = sample();
  const back = parseProject(serializeProject(p));
  expect(back).toEqual(p);
  expect(back.sheet.cells).toBeInstanceOf(Uint8Array);
});

test('roundtrip works for every sheet size including 116', () => {
  const sheet = createSheet(116, 116);
  for (let i = 0; i < sheet.cells.length; i++) sheet.cells[i] = i % 33;
  const back = parseProject(serializeProject(createProject('x', sheet, now)));
  expect([...back.sheet.cells]).toEqual([...sheet.cells]);
});

test('parseProject rejects future formatVersion', () => {
  expect(() => parseProject(withField({ formatVersion: 2 }))).toThrow(ProjectParseError);
});

test('parseProject rejects wrong cells length and out-of-range values', () => {
  const short = JSON.parse(serializeProject(sample()));
  short.sheet.cells = 'AAAA';
  expect(() => parseProject(JSON.stringify(short))).toThrow(ProjectParseError);
  const bad = sample();
  bad.sheet.cells[5] = 40;
  expect(() => parseProject(serializeProject(bad))).toThrow(ProjectParseError);
  expect(() => parseProject(withField({ sheet: { width: 30, height: 30, cells: '', paletteId: 'perler-32' } }))).toThrow(ProjectParseError);
});

test('parseProject rejects broken JSON and wrong stage', () => {
  expect(() => parseProject('{')).toThrow(ProjectParseError);
  expect(() => parseProject(withField({ stage: 'other' }))).toThrow(ProjectParseError);
});

test('newProjectId is unique across calls', () => {
  expect(new Set(Array.from({ length: 100 }, newProjectId)).size).toBe(100);
});
