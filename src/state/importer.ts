import { BeadsError, type BeadsErrorReason, unpackBeads } from '@/core/file/beads';
import type { Project } from '@/core/file/project';
import type { ProjectRepo } from '@/platform/projectRepo.types';

/** .beads を読み込んで新しい作品として保存する。壊れたファイルなら BeadsError（何も保存しない）。 */
export async function importBeads(repo: ProjectRepo, bytes: Uint8Array, now: Date): Promise<{ id: string; stage: Project['stage'] }> {
  const { project, sourcePng } = unpackBeads(bytes, now);
  if (sourcePng && project.source) project.source = { ...project.source, image: await repo.saveSource(project.id, sourcePng) };
  await repo.save(project);
  return { id: project.id, stage: project.stage };
}

export const IMPORT_MESSAGES: Record<BeadsErrorReason | 'unreadable', string> = {
  'not-zip': 'デジタル・アイロンビーズのファイルではありません',
  'not-beads': 'デジタル・アイロンビーズのファイルではありません',
  'bad-project': 'ファイルが壊れています',
  'future-version': '新しいバージョンのアプリで作られたファイルです。アプリを更新してください',
  unreadable: 'ファイルを読み込めませんでした',
};

export function importErrorMessage(e: unknown): string {
  return e instanceof BeadsError ? IMPORT_MESSAGES[e.reason] : IMPORT_MESSAGES.unreadable;
}
