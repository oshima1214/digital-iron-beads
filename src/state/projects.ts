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
        const png = await fetchSource(repo, p.id, p.source.image);
        if (png) copy.source = { ...p.source, image: await repo.saveSource(copy.id, png) };
        else delete copy.source;
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

/** 元画像のバイト列を読む（data: URI と file: URI の両方）。読めなければ null。 */
async function fetchSource(repo: ProjectRepo, id: string, name: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(repo.sourceUri(id, name));
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
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
