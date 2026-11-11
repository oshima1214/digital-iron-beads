import type { ConvertSettings } from '../convert/types';
import type { CropRect } from '../image/adjust';
import { createSheet, type Sheet, type SheetSize } from '../sheet/sheet';
import { base64ToBytes, bytesToBase64 } from './base64';

export const FORMAT_VERSION = 1;
const SIZES: readonly number[] = [13, 21, 29, 58, 116];

export interface ProjectSource {
  /** 作品フォルダ内のファイル名（例 "source.png"） */
  image: string;
  crop?: CropRect;
  brightness: number;
  contrast: number;
  convert: ConvertSettings;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** setup = ③ ビーズ化設定の途中、edit = シート作成済み */
  stage: 'setup' | 'edit';
  sheet: Sheet;
  source?: ProjectSource;
  nav?: { plateIndex: number; colorIndex: number };
  formatVersion: 1;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  stage: Project['stage'];
  sheet: Sheet;
}

export class ProjectParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectParseError';
  }
}

export function newProjectId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

export function createProject(name: string, sheet: Sheet, now: Date): Project {
  const t = now.toISOString();
  return { id: newProjectId(), name, createdAt: t, updatedAt: t, stage: 'edit', sheet, formatVersion: 1 };
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, sheet: { ...p.sheet, cells: bytesToBase64(p.sheet.cells) } });
}

function fail(msg: string): never {
  throw new ProjectParseError(msg);
}

export function parseProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail('project.json is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) fail('project.json is not an object');
  const o = raw as Record<string, unknown>;
  if (o.formatVersion !== FORMAT_VERSION) fail(`unsupported formatVersion: ${String(o.formatVersion)}`);
  for (const k of ['id', 'name', 'createdAt', 'updatedAt'] as const) if (typeof o[k] !== 'string') fail(`${k} must be a string`);
  if (o.stage !== 'setup' && o.stage !== 'edit') fail('stage must be setup or edit');
  const s = o.sheet as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object') fail('sheet is missing');
  const { width, height } = s;
  if (typeof width !== 'number' || !SIZES.includes(width) || width !== height) fail('unsupported sheet size');
  if (s.paletteId !== 'perler-32') fail('unsupported palette');
  const cells = typeof s.cells === 'string' ? base64ToBytes(s.cells) : null;
  if (!cells || cells.length !== width * width) fail('cells length mismatch');
  if (cells.some((v) => v > 32)) fail('cell value out of range');
  const sheet = createSheet(width as SheetSize, width as SheetSize);
  sheet.cells.set(cells);
  return { ...(o as unknown as Project), sheet };
}
