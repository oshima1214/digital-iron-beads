import { createStore, useStore } from 'zustand';

import { newProjectId, type ProjectSummary } from '@/core/file/project';
import { cloneSheet } from '@/core/sheet/sheet';
import type { ProjectRepo } from '@/platform/projectRepo.types';

export interface ProjectsState {
  items: ProjectSummary[];
  loading: boolean;
  refresh(): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createProjectsStore(repo: ProjectRepo, now: () => Date = () => new Date()) {
  return createStore<ProjectsState>()((set, get) => ({
    items: [],
    loading: false,
    async refresh() {
      set({ loading: true });
      try {
        set({ items: await repo.list() });
      } finally {
        set({ loading: false });
      }
    },
    async rename(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const p = await repo.load(id);
      await repo.save({ ...p, name: trimmed, updatedAt: now().toISOString() });
      await get().refresh();
    },
    async duplicate(id) {
      const p = await repo.load(id);
      const t = now().toISOString();
      const copy = { ...p, id: newProjectId(), name: `${p.name} のコピー`, createdAt: t, updatedAt: t, sheet: cloneSheet(p.sheet) };
      if (p.source) {
        const image = await repo.copySource(p.id, copy.id, p.source.image);
        if (image) copy.source = { ...p.source, image };
        else {
          // 元画像がなければ続きから変換できないので、編集用の作品として複製する
          delete copy.source;
          copy.stage = 'edit';
        }
      }
      await repo.save(copy);
      await get().refresh();
    },
    async remove(id) {
      await repo.remove(id);
      await get().refresh();
    },
  }));
}

let shared: ReturnType<typeof createProjectsStore> | null = null;

export function projectsStore() {
  if (!shared) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { projectRepo } = require('@/platform/projectRepo') as typeof import('@/platform/projectRepo');
    shared = createProjectsStore(projectRepo);
  }
  return shared;
}

export function useProjects<T>(selector: (s: ProjectsState) => T): T {
  return useStore(projectsStore(), selector);
}
