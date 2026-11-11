import { parseProject, ProjectParseError, serializeProject } from '@/core/file/project';
import { bytesToBase64 } from '@/core/file/base64';

import { byUpdatedDesc, type ProjectRepo, summarize } from './projectRepo.types';

/** テスト用。保存形式は本番と同じ JSON 文字列。 */
export function createMemoryRepo(): ProjectRepo & { corrupt(id: string): void; failSaves(on: boolean): void } {
  const store = new Map<string, string>();
  const sources = new Map<string, string>();
  let failing = false;
  return {
    async list() {
      const out = [];
      for (const [id, json] of store) {
        try {
          out.push(summarize(parseProject(json)));
        } catch (e) {
          console.warn(`skip corrupt project ${id}`, e);
        }
      }
      return out.sort(byUpdatedDesc);
    },
    async load(id) {
      const json = store.get(id);
      if (json === undefined) throw new ProjectParseError(`project not found: ${id}`);
      return parseProject(json);
    },
    async save(p) {
      if (failing) throw new Error('save failed (test)');
      store.set(p.id, serializeProject(p));
    },
    async remove(id) {
      store.delete(id);
      sources.delete(id);
    },
    async saveSource(id, png) {
      sources.set(id, bytesToBase64(png));
      return 'source.png';
    },
    sourceUri(id) {
      return `data:image/png;base64,${sources.get(id) ?? ''}`;
    },
    async copySource(fromId, toId, name) {
      const src = sources.get(fromId);
      if (!src) return null;
      sources.set(toId, src);
      return name;
    },
    failSaves(on) {
      failing = on;
    },
    corrupt(id) {
      store.set(id, '{"broken":');
    },
  };
}
