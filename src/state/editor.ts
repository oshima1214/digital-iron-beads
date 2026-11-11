import { createStore, useStore } from 'zustand';

import type { Project } from '@/core/file/project';
import { History } from '@/core/history/history';
import { PERLER32 } from '@/core/palette/perler32';
import { countBeads } from '@/core/sheet/counts';
import { applyChanges, type Cell, type CellChange, floodFill, lineCells, outline, paintCells, rectCells } from '@/core/sheet/ops';
import { idx } from '@/core/sheet/sheet';
import { createAutosaver } from '@/core/util/autosave';
import type { ProjectRepo } from '@/platform/projectRepo.types';

export type Tool = 'pen' | 'eraser' | 'bucket' | 'select';

export interface EditorState {
  project: Project | null;
  error: 'open-failed' | null;
  /** シートを変えるたびに増える（描画のきっかけ） */
  version: number;
  tool: Tool;
  /** 1..32 */
  color: number;
  selection: ReadonlySet<number>;
  rangeMode: boolean;
  range: [Cell, Cell] | null;
  mirror: boolean;
  melted: boolean;
  canUndo: boolean;
  canRedo: boolean;
  open(id: string): Promise<void>;
  setTool(t: Tool): void;
  setColor(i: number): void;
  /** null = シートの外 */
  strokeBegin(c: Cell | null): void;
  strokeMove(c: Cell | null): void;
  strokeEnd(): void;
  bucket(c: Cell | null): void;
  tapSelect(c: Cell | null): void;
  rangeMove(c: Cell | null): void;
  rangeEnd(): void;
  recolorSelection(): void;
  deleteSelection(): void;
  clearSelection(): void;
  applyOutline(thickness: 1 | 2): void;
  undo(): void;
  redo(): void;
  toggleMirror(): void;
  toggleMelted(): void;
  setRangeMode(on: boolean): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

const BLACK = PERLER32.find((b) => b.code === '5018')!.index;

export function createEditorStore(repo: ProjectRepo, now: () => Date = () => new Date(), autosaveMs = 500) {
  const saver = createAutosaver<Project>((p) => repo.save(p), autosaveMs);
  let history = new History();
  let stroke: { changes: Map<number, CellChange>; last: Cell | null } | null = null;

  return createStore<EditorState>()((set, get) => {
    /** 差分をすでに適用したあとに呼ぶ：版を進め、自動保存を予約する。 */
    const touched = () => {
      const p = get().project;
      if (!p) return;
      const next = { ...p, updatedAt: now().toISOString() };
      set({ project: next, version: get().version + 1, canUndo: history.canUndo, canRedo: history.canRedo });
      saver.schedule(next);
    };
    /** 1回の操作：差分を適用して履歴に積む。 */
    const commit = (changes: CellChange[]) => {
      const p = get().project;
      if (!p || changes.length === 0) return;
      applyChanges(p.sheet, changes, 'forward');
      history.push(changes);
      touched();
    };
    const paintValue = () => (get().tool === 'eraser' ? 0 : get().color);
    const strokeTo = (c: Cell) => {
      const p = get().project;
      if (!p || !stroke) return;
      const path = stroke.last ? lineCells(stroke.last, c) : [c];
      const changes = paintCells(p.sheet, path, paintValue());
      for (const ch of changes) if (!stroke.changes.has(ch.i)) stroke.changes.set(ch.i, ch);
      applyChanges(p.sheet, changes, 'forward');
      stroke.last = c;
      if (changes.length) set({ version: get().version + 1 });
    };

    return {
      project: null,
      error: null,
      version: 0,
      tool: 'pen',
      color: BLACK,
      selection: new Set(),
      rangeMode: false,
      range: null,
      mirror: false,
      melted: false,
      canUndo: false,
      canRedo: false,

      async open(id) {
        await saver.flush();
        history = new History();
        stroke = null;
        try {
          const p = await repo.load(id);
          const top = countBeads(p.sheet)[0];
          set({
            project: p,
            error: null,
            version: get().version + 1,
            tool: 'pen',
            color: top ? top.index : BLACK,
            selection: new Set(),
            range: null,
            rangeMode: false,
            melted: false,
            canUndo: false,
            canRedo: false,
          });
        } catch (e) {
          console.warn('could not open project', e);
          set({ project: null, error: 'open-failed' });
        }
      },

      setTool(t) {
        set({ tool: t, range: null, ...(t === 'select' ? {} : { selection: new Set<number>() }) });
      },
      setColor(i) {
        set({ color: i });
      },

      strokeBegin(c) {
        stroke = { changes: new Map(), last: null };
        if (c) strokeTo(c);
      },
      strokeMove(c) {
        if (!stroke || !c) return;
        strokeTo(c);
      },
      strokeEnd() {
        if (!stroke) return;
        const changes = [...stroke.changes.values()];
        stroke = null;
        if (changes.length === 0) return;
        history.push(changes);
        touched();
      },

      bucket(c) {
        const p = get().project;
        if (!p || !c) return;
        commit(floodFill(p.sheet, c[0], c[1], get().color));
      },

      tapSelect(c) {
        const p = get().project;
        if (!p || !c) return;
        if (get().rangeMode) {
          set({ range: [c, c] });
          return;
        }
        const i = idx(p.sheet, c[0], c[1]);
        const next = new Set(get().selection);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        set({ selection: next });
      },
      rangeMove(c) {
        const r = get().range;
        if (!r || !c) return;
        set({ range: [r[0], c] });
      },
      rangeEnd() {
        const p = get().project;
        const r = get().range;
        if (!p || !r) return;
        const next = new Set(get().selection);
        for (const [x, y] of rectCells(r[0], r[1])) next.add(idx(p.sheet, x, y));
        set({ selection: next, range: null });
      },
      recolorSelection() {
        const p = get().project;
        if (!p) return;
        commit(paintCells(p.sheet, toCells(p, get().selection), get().color));
        set({ selection: new Set() });
      },
      deleteSelection() {
        const p = get().project;
        if (!p) return;
        commit(paintCells(p.sheet, toCells(p, get().selection), 0));
        set({ selection: new Set() });
      },
      clearSelection() {
        set({ selection: new Set(), range: null });
      },

      applyOutline(thickness) {
        const p = get().project;
        if (!p) return;
        commit(outline(p.sheet, get().color, thickness));
      },

      undo() {
        const p = get().project;
        if (!p || stroke) return;
        if (history.undo(p.sheet)) touched();
      },
      redo() {
        const p = get().project;
        if (!p || stroke) return;
        if (history.redo(p.sheet)) touched();
      },

      toggleMirror() {
        set({ mirror: !get().mirror });
      },
      toggleMelted() {
        set({ melted: !get().melted });
      },
      setRangeMode(on) {
        set({ rangeMode: on, range: null });
      },

      flush: () => saver.flush(),
      async close() {
        if (stroke) get().strokeEnd();
        await saver.flush();
        history = new History();
        set({ project: null, error: null, selection: new Set(), range: null, canUndo: false, canRedo: false });
      },
    };
  });
}

function toCells(p: Project, sel: ReadonlySet<number>): Cell[] {
  return [...sel].map((i) => [i % p.sheet.width, Math.floor(i / p.sheet.width)]);
}

let shared: ReturnType<typeof createEditorStore> | null = null;

export function editorStore() {
  if (!shared) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { projectRepo } = require('@/platform/projectRepo') as typeof import('@/platform/projectRepo');
    shared = createEditorStore(projectRepo);
  }
  return shared;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore(), selector);
}
