import type { Project, ProjectSummary } from '@/core/file/project';

export interface ProjectRepo {
  /** updatedAt の新しい順。壊れた作品は除き console.warn で知らせる。 */
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project>;
  save(p: Project): Promise<void>;
  remove(id: string): Promise<void>;
  /** 元画像（PNG）を作品フォルダに保存し、ファイル名を返す。 */
  saveSource(id: string, png: Uint8Array): Promise<string>;
  /** 保存した元画像を表示・読み込みに使う URI。 */
  sourceUri(id: string, name: string): string;
  /** 元画像を別の作品へコピーする。元画像がなければ null。 */
  copySource(fromId: string, toId: string, name: string): Promise<string | null>;
}

export function summarize(p: Project): ProjectSummary {
  return { id: p.id, name: p.name, updatedAt: p.updatedAt, stage: p.stage, sheet: p.sheet };
}

export function byUpdatedDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
}
