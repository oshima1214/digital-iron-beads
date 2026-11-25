import { createStore, useStore } from 'zustand';

import type { Project } from '@/core/file/project';
import { History } from '@/core/history/history';
import { RANGE_IDLE, type RangeEvent, rangeOf, type RangeState, rangeStep } from '@/core/machines/rangeSelect';
import { PALETTE } from '@/core/palette/perler';
import { editorPalette } from '@/core/palette/projectBeads';
import { countBeads } from '@/core/sheet/counts';
import { applyChanges, brushCells, type Cell, type CellChange, floodFill, lineCells, outline, paintCells, rectCells } from '@/core/sheet/ops';
import { idx } from '@/core/sheet/sheet';
import { createAutosaver } from '@/core/util/autosave';
import type { ProjectRepo } from '@/platform/projectRepo.types';

export type Tool = 'pen' | 'eraser' | 'bucket' | 'select';

export interface EditorState {
  project: Project | null;
  error: 'open-failed' | null;
  /** シートを変えるたびに増える（描画のきっかけ。ストロークの途中も増える） */
  version: number;
  /** 編集が確定するたびに増える（必要数やパレットの並びの再計算に使う） */
  committed: number;
  tool: Tool;
  /** 1..32 */
  color: number;
  selection: ReadonlySet<number>;
  rangeMode: boolean;
  /** 範囲選択で画面に描く矩形（rangePhase から決まる） */
  range: [Cell, Cell] | null;
  /** 範囲選択の状態（core/machines/rangeSelect）。anchored = 1点目を置いて2点目を待っている */
  rangePhase: RangeState['phase'];
  mirror: boolean;
  melted: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** 操作しても何も変わらなかった理由（画面に一言出す）。次の操作で消える */
  notice: 'same-color' | null;
  open(id: string): Promise<void>;
  /** 画面から呼ぶ：この作品が開いていなければ（閉じる途中も含む）読み込む。開いていれば何もしない */
  ensureOpen(id: string): Promise<void>;
  setTool(t: Tool): void;
  setColor(i: number): void;
  /** 作品名を変える（前後の空白を除く。空なら変えない）。書き出し画面から使う */
  setName(name: string): void;
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

const BLACK = PALETTE.find((b) => b.code === '5018')!.index;

export function createEditorStore(
  repo: ProjectRepo,
  now: () => Date = () => new Date(),
  autosaveMs = 500,
  /** ペン・消しゴムの太さ（マス）。設定から読む */
  brushSize: (tool: 'pen' | 'eraser') => number = () => 1,
) {
  // 編集画面の保存はナビの進み具合（nav）を書き換えない。nav はナビ画面だけが書く（古い値で上書きしないように）
  const saver = createAutosaver<Project>(async (p) => {
    let nav = p.nav;
    try {
      nav = (await repo.load(p.id)).nav;
    } catch {
      // まだ保存されていない作品などは手元の値を使う
    }
    await repo.save({ ...p, nav });
  }, autosaveMs);
  let history = new History();
  let stroke: { changes: Map<number, CellChange>; last: Cell | null } | null = null;
  // 範囲選択の状態機械（ドラッグ／2点タップ）。画面には range と rangePhase として見せる
  let rangeState: RangeState = RANGE_IDLE;

  return createStore<EditorState>()((set, get) => {
    /** 差分をすでに適用したあとに呼ぶ：版を進め、自動保存を予約する。 */
    const touched = () => {
      const p = get().project;
      if (!p) return;
      const next = { ...p, updatedAt: now().toISOString() };
      set({ project: next, version: get().version + 1, committed: get().committed + 1, canUndo: history.canUndo, canRedo: history.canRedo });
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
    /** 範囲選択の状態機械を1歩進める。確定した矩形があれば返す。 */
    const stepRange = (event: RangeEvent): [Cell, Cell] | undefined => {
      const { state, commit } = rangeStep(rangeState, event);
      if (state !== rangeState) {
        rangeState = state;
        set({ range: rangeOf(state), rangePhase: state.phase });
      }
      return commit;
    };
    const paintValue = () => (get().tool === 'eraser' ? 0 : get().color);
    const strokeTo = (c: Cell) => {
      const p = get().project;
      if (!p || !stroke) return;
      const path = stroke.last ? lineCells(stroke.last, c) : [c];
      const size = brushSize(get().tool === 'eraser' ? 'eraser' : 'pen');
      const mirror = get().mirror;
      const cells = size <= 1 ? path : path.flatMap((pc) => brushCells(pc, size, mirror));
      const changes = paintCells(p.sheet, cells, paintValue());
      for (const ch of changes) if (!stroke.changes.has(ch.i)) stroke.changes.set(ch.i, ch);
      applyChanges(p.sheet, changes, 'forward');
      stroke.last = c;
      if (changes.length) set({ version: get().version + 1 });
    };

    // open / close は後から呼んだほうが勝つ。待っているあいだに次の open / close が来たら、結果を捨てる
    // （ホームに戻った直後に作品を開くと、ホームの close が開いたばかりの作品を消していた）
    let generation = 0;
    /** 開いている（開こうとしている）作品の id。close を呼んだ時点で null にする */
    let active: string | null = null;

    return {
      project: null,
      error: null,
      version: 0,
      committed: 0,
      tool: 'pen',
      color: BLACK,
      selection: new Set(),
      rangeMode: false,
      range: null,
      rangePhase: 'idle',
      mirror: false,
      melted: false,
      canUndo: false,
      canRedo: false,
      notice: null,

      async open(id) {
        const mine = ++generation;
        active = id;
        await saver.flush();
        if (mine !== generation) return;
        history = new History();
        stroke = null;
        stepRange({ type: 'cancel' });
        try {
          const p = await repo.load(id);
          if (mine !== generation) return;
          const top = countBeads(p.sheet)[0];
          // 最初の色：一番多く使っている色。なければ黒、黒が選べない作品（2色など）は選べる色の最初
          const pal = editorPalette(p);
          const first = top ? top.index : pal.includes(BLACK) ? BLACK : pal[0];
          set({
            project: p,
            error: null,
            version: get().version + 1,
            committed: get().committed + 1,
            tool: 'pen',
            color: first,
            selection: new Set(),
            range: null,
            rangePhase: 'idle',
            rangeMode: false,
            melted: false,
            canUndo: false,
            canRedo: false,
          });
        } catch (e) {
          if (mine !== generation) return;
          console.warn('could not open project', e);
          set({ project: null, error: 'open-failed' });
        }
      },

      setTool(t) {
        stepRange({ type: 'cancel' });
        set({ tool: t, notice: null, ...(t === 'select' ? {} : { selection: new Set<number>() }) });
      },
      setName(name) {
        const p = get().project;
        const n = name.trim();
        if (!p || !n || n === p.name) return;
        const next = { ...p, name: n, updatedAt: now().toISOString() };
        set({ project: next });
        saver.schedule(next);
      },
      setColor(i) {
        set({ color: i, notice: null });
      },

      strokeBegin(c) {
        stroke = { changes: new Map(), last: null };
        if (c) strokeTo(c);
      },
      strokeMove(c) {
        if (!stroke) return;
        // シートの外に出たら線を切る（戻ってきた場所から塗り直す。内側を横切る線を引かない）
        if (!c) stroke.last = null;
        else strokeTo(c);
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
        const changes = floodFill(p.sheet, c[0], c[1], get().color);
        // 同じ色の場所をタップしても何も変わらない：黙っていると「動かない」と感じるので理由を出す
        set({ notice: changes.length === 0 ? 'same-color' : null });
        commit(changes);
      },

      tapSelect(c) {
        const p = get().project;
        if (!p || !c) return;
        if (get().rangeMode) {
          stepRange({ type: 'press', cell: c });
          return;
        }
        const i = idx(p.sheet, c[0], c[1]);
        const next = new Set(get().selection);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        set({ selection: next });
      },
      rangeMove(c) {
        stepRange({ type: 'move', cell: c });
      },
      rangeEnd() {
        const p = get().project;
        if (!p) return;
        const rect = stepRange({ type: 'release' });
        if (!rect) return;
        const next = new Set(get().selection);
        for (const [x, y] of rectCells(rect[0], rect[1])) next.add(idx(p.sheet, x, y));
        set({ selection: next });
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
        stepRange({ type: 'cancel' });
        set({ selection: new Set() });
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
        stepRange({ type: 'cancel' });
        set({ rangeMode: on });
      },

      flush: () => saver.flush(),
      ensureOpen(id) {
        if (active === id && !get().error) return Promise.resolve();
        return get().open(id);
      },

      async close() {
        const mine = ++generation;
        active = null;
        if (stroke) get().strokeEnd();
        await saver.flush();
        if (mine !== generation) return;
        history = new History();
        stepRange({ type: 'cancel' });
        set({ project: null, error: null, selection: new Set(), canUndo: false, canRedo: false });
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { settingsStore } = require('./settings') as typeof import('./settings');
    shared = createEditorStore(projectRepo, undefined, undefined, (tool) => {
      const s = settingsStore().getState().settings;
      return tool === 'pen' ? s.penSize : s.eraserSize;
    });
  }
  return shared;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore(), selector);
}
