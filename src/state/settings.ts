import { createStore, useStore } from 'zustand';

import { beadsForSet } from '@/core/palette/perler';

export interface AppSettings {
  /** 実寸表示の補正係数 0.90..1.10 */
  calibration: number;
  /** 実物に合わせて調整したことがあるか */
  calibrated: boolean;
  /** iPad 横向きのパネルの位置 */
  panelSide: 'left' | 'right';
  /** ペンの太さ（マス）1..7 */
  penSize: number;
  /** 消しゴムの太さ（マス）1..7 */
  eraserSize: number;
  /** 手持ちのビーズ（番号、昇順）。すべての作品で共通。最初は空 */
  ownedBeads: number[];
}

export const BRUSH_MIN = 1;
export const BRUSH_MAX = 7;
export type BrushTool = 'pen' | 'eraser';
const clampBrush = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(v))) : 1);

export const DEFAULT_SETTINGS: AppSettings = { calibration: 1, calibrated: false, panelSide: 'right', penSize: 1, eraserSize: 1, ownedBeads: [] };
export const CALIBRATION_MIN = 0.9;
export const CALIBRATION_MAX = 1.1;

export interface SettingsRepo {
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
}

const clampCal = (v: number) => Math.min(CALIBRATION_MAX, Math.max(CALIBRATION_MIN, v));

/** 壊れた設定は既定値として扱う（落ちない）。 */
export function parseSettings(json: string): AppSettings {
  try {
    const o = JSON.parse(json) as Partial<AppSettings> | null;
    if (!o || typeof o !== 'object') return { ...DEFAULT_SETTINGS };
    if (o.panelSide !== undefined && o.panelSide !== 'left' && o.panelSide !== 'right') return { ...DEFAULT_SETTINGS };
    return {
      calibration: typeof o.calibration === 'number' && Number.isFinite(o.calibration) ? clampCal(o.calibration) : 1,
      calibrated: o.calibrated === true,
      panelSide: o.panelSide ?? 'right',
      penSize: clampBrush(o.penSize),
      eraserSize: clampBrush(o.eraserSize),
      ownedBeads: Array.isArray(o.ownedBeads) ? beadsForSet('owned', o.ownedBeads as number[]) : [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load(): Promise<void>;
  setCalibration(v: number): Promise<void>;
  setPanelSide(side: AppSettings['panelSide']): Promise<void>;
  setBrushSize(tool: BrushTool, size: number): Promise<void>;
  setOwnedBeads(beads: readonly number[]): Promise<void>;
  reset(): Promise<void>;
}

export function createSettingsStore(repo: SettingsRepo) {
  return createStore<SettingsState>()((set, get) => {
    const save = async (next: AppSettings) => {
      set({ settings: next });
      try {
        await repo.write(JSON.stringify(next));
      } catch (e) {
        console.warn('could not save settings', e);
      }
    };
    return {
      settings: { ...DEFAULT_SETTINGS },
      loaded: false,
      async load() {
        try {
          const json = await repo.read();
          set({ settings: json ? parseSettings(json) : { ...DEFAULT_SETTINGS }, loaded: true });
        } catch (e) {
          console.warn('could not read settings', e);
          set({ settings: { ...DEFAULT_SETTINGS }, loaded: true });
        }
      },
      setCalibration: (v) => save({ ...get().settings, calibration: clampCal(v), calibrated: true }),
      setPanelSide: (side) => save({ ...get().settings, panelSide: side }),
      setBrushSize: (tool, size) => save({ ...get().settings, [tool === 'pen' ? 'penSize' : 'eraserSize']: clampBrush(size) }),
      setOwnedBeads: (beads) => save({ ...get().settings, ownedBeads: beadsForSet('owned', beads) }),
      // 手持ちのビーズは、選び直すのが手間なので初期化しない
      reset: () => save({ ...DEFAULT_SETTINGS, ownedBeads: get().settings.ownedBeads }),
    };
  });
}

let shared: ReturnType<typeof createSettingsStore> | null = null;

export function settingsStore() {
  if (!shared) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { settingsRepo } = require('@/platform/settingsRepo') as typeof import('@/platform/settingsRepo');
    shared = createSettingsStore(settingsRepo);
    void shared.getState().load();
  }
  return shared;
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(settingsStore(), selector);
}
