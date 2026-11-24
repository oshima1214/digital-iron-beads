import { defaultConvertSettings } from '../convert/types';
import { createProject } from '../file/project';
import { createSheet } from '../sheet/sheet';
import { ALL64, BASIC16 } from './perler';
import { beadSetLabel, editorPalette } from './projectBeads';

const base = () => createProject('x', createSheet(13, 13), new Date('2026-11-24T00:00:00Z'));
const withSource = (convert: Partial<ReturnType<typeof defaultConvertSettings>>) => {
  const p = base();
  p.source = { image: 'source.png', brightness: 0, contrast: 0, convert: { ...defaultConvertSettings(13), ...convert } };
  return p;
};

test('a work made with 16 colors edits with those 16 colors (plus any color already on the sheet)', () => {
  const p = withSource({ beadSet: '16', allowedBeads: [...BASIC16] });
  expect(editorPalette(p)).toEqual([...BASIC16]);
  p.sheet.cells[0] = 40;
  expect(editorPalette(p)).toEqual([...BASIC16, 40]);
  expect(beadSetLabel(p)).toBe('16色');
});

test('owned beads, two colors, and works without a photo', () => {
  expect(editorPalette(withSource({ beadSet: 'owned', allowedBeads: [3, 40, 1] }))).toEqual([1, 3, 40]);
  expect(beadSetLabel(withSource({ beadSet: 'owned', allowedBeads: [3, 40, 1] }))).toBe('手持ち3色');
  const two = withSource({ preset: 'twoColor', twoColor: { dark: 8, light: 1, threshold: 0.5 } });
  expect(editorPalette(two)).toEqual([1, 8]);
  expect(beadSetLabel(two)).toBe('2色');
  expect(editorPalette(base())).toEqual([...ALL64]);
  expect(beadSetLabel(base())).toBe('64色');
  expect(beadSetLabel(withSource({ beadSet: 'original' }))).toBe('元の色');
  expect(beadSetLabel(withSource({ beadSet: '8', allowedBeads: [1, 2, 3, 4, 5, 6, 7, 8] }))).toBe('8色');
});
