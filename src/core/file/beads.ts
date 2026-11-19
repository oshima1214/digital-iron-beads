import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { RgbaImage } from '../convert/types';
import { cropImage } from '../image/adjust';

import { BEADS_MIME } from '../appIdentity';
import { FORMAT_VERSION, newProjectId, parseProject, type Project, serializeProject } from './project';

export type BeadsErrorReason = 'not-zip' | 'not-beads' | 'bad-project' | 'future-version';

export class BeadsError extends Error {
  constructor(public readonly reason: BeadsErrorReason) {
    super(`invalid .beads file: ${reason}`);
    this.name = 'BeadsError';
  }
}

/** .beads = zip（mimetype、project.json、あれば source.png）。 */
export function packBeads(p: Project, sourcePng: Uint8Array | null): Uint8Array {
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8(BEADS_MIME),
    'project.json': strToU8(serializeProject(p)),
  };
  if (sourcePng) files['source.png'] = sourcePng;
  return zipSync(files);
}

/** .beads を開く。新しい id を振り、進み具合（nav）は消す。元画像がなければ編集用（stage edit）にする。 */
export function unpackBeads(bytes: Uint8Array, now: Date): { project: Project; sourcePng: Uint8Array | null } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BeadsError('not-zip');
  }
  const json = files['project.json'];
  if (!json) throw new BeadsError('not-beads');
  const text = strFromU8(json);
  let version: unknown;
  try {
    version = (JSON.parse(text) as { formatVersion?: unknown }).formatVersion;
  } catch {
    throw new BeadsError('bad-project');
  }
  if (typeof version === 'number' && version > FORMAT_VERSION) throw new BeadsError('future-version');
  let p: Project;
  try {
    p = parseProject(text);
  } catch {
    throw new BeadsError('bad-project');
  }
  const sourcePng = files['source.png'] ?? null;
  const t = now.toISOString();
  const project: Project = { ...p, id: newProjectId(), createdAt: t, updatedAt: t };
  delete project.nav;
  if (!sourcePng || !project.source) {
    delete project.source;
    project.stage = 'edit';
  }
  return { project, sourcePng: project.source ? sourcePng : null };
}

/**
 * 書き出す .beads には、切り抜いた後の画像だけを入れる（切り抜いた外側の写真を人に渡さない）。
 * 切り抜き枠は画像に焼き込んで消す。明るさ・コントラストなどの設定はそのまま残す。元の作品は変えない。
 */
export function bakeCrop(p: Project, image: RgbaImage): { project: Project; image: RgbaImage } {
  const crop = p.source?.crop;
  if (!p.source || !crop) return { project: p, image };
  const source = { ...p.source };
  delete source.crop;
  return { project: { ...p, source }, image: cropImage(image, crop) };
}
