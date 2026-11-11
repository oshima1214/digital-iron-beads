// Web（自動テスト用）: localStorage。元画像は data URL で保存する。
import { bytesToBase64 } from '@/core/file/base64';
import { parseProject, ProjectParseError, serializeProject } from '@/core/file/project';
import type { ProjectSummary } from '@/core/file/project';

import { byUpdatedDesc, type ProjectRepo, summarize } from './projectRepo.types';

const KEY = 'dib:project:';
const SRC = 'dib:source:';

export const projectRepo: ProjectRepo = {
  async list() {
    const out: ProjectSummary[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(KEY)) continue;
      try {
        out.push(summarize(parseProject(localStorage.getItem(k) ?? '')));
      } catch (e) {
        console.warn(`skip corrupt project ${k}`, e);
      }
    }
    return out.sort(byUpdatedDesc);
  },
  async load(id) {
    const json = localStorage.getItem(KEY + id);
    if (json === null) throw new ProjectParseError(`project not found: ${id}`);
    return parseProject(json);
  },
  async save(p) {
    localStorage.setItem(KEY + p.id, serializeProject(p));
  },
  async remove(id) {
    localStorage.removeItem(KEY + id);
    localStorage.removeItem(SRC + id);
  },
  async saveSource(id, png) {
    localStorage.setItem(SRC + id, bytesToBase64(png));
    return 'source.png';
  },
  sourceUri(id) {
    return `data:image/png;base64,${localStorage.getItem(SRC + id) ?? ''}`;
  },
};
