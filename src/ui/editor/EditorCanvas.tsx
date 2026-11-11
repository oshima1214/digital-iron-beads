import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, Platform, Text, View } from 'react-native';

import { fitPlate, halfRows, PLATE_CELLS } from '@/core/physical';
import { type Plate, plateSheet } from '@/core/sheet/plates';
import type { Sheet } from '@/core/sheet/sheet';

import type { Cell } from '@/core/sheet/ops';
import { editorStore, useEditor } from '@/state/editor';

import { SelectionOverlay } from '../SelectionOverlay';
import { SheetCanvas } from '../SheetCanvas';
import { colors, fonts } from '../theme';
import { sheetLayout, viewToCell } from '../sheetGeometry';
import { clampTransform, IDENTITY, pinch, type Pt, toContent, type Transform } from '../zoom';
import { createTouchTracker, HOLD_MS, type TouchAction, type TouchPoint } from './touchTracker';

/** iPhone だけピンチズームとドラッグでの移動を許す（iPad はプレートを重ねるので動かさない）。 */
const CAN_ZOOM = Platform.OS === 'ios' && !Platform.isPad;
// 注意：プレート表示（iPad）のときはズームしない（CAN_ZOOM は iPad で常に false）

/** 値の変化を1フレームに1回までにまとめる（塗るたびにシート全体を描き直さないように）。 */
function useFrameThrottled<T>(value: T): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return shown;
}

interface Props {
  /** iPad：このプレートだけを実寸で描く（null ならシート全体） */
  plate?: Plate | null;
  /** iPad：実寸の1マスの大きさ */
  physicalCell?: number | null;
  half?: 0 | 1;
  onFit?(fit: { fits: 'full' | 'half' | 'none'; rows: number }): void;
}

export function EditorCanvas({ plate = null, physicalCell = null, half = 0, onFit }: Props = {}) {
  const project = useEditor((s) => s.project);
  const liveVersion = useEditor((s) => s.version);
  const version = useFrameThrottled(liveVersion);
  const mirror = useEditor((s) => s.mirror);
  const melted = useEditor((s) => s.melted);
  const selection = useEditor((s) => s.selection);
  const range = useEditor((s) => s.range);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<Transform>(IDENTITY);
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const tracker = useRef(createTouchTracker(CAN_ZOOM));
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchStart = useRef<{ t: Transform; a: Pt; b: Pt } | null>(null);

  const full = project?.sheet;
  // iPad はプレート1枚（半分表示なら一部の行）だけを実寸で描き、マス座標にプレートの原点を足す
  const plateMode = !!(plate && physicalCell && full);
  const fit = plateMode && box.w > 0 ? fitPlate(physicalCell!, box.w, box.h) : { fits: 'full' as const, rows: PLATE_CELLS };
  const rows: [number, number] = fit.fits === 'half' ? halfRows(half, fit.rows) : [0, PLATE_CELLS];
  const sheet = useMemo(
    () => (plateMode ? plateSheet(full!, plate!, rows) : full),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [full, plateMode, plate, rows[0], rows[1], version],
  );
  const offset = plateMode ? { x: plate!.originX, y: plate!.originY + rows[0] } : { x: 0, y: 0 };
  const layout = !sheet
    ? { cell: 0, width: 0, height: 0 }
    : plateMode
      ? { cell: physicalCell!, width: physicalCell! * sheet.width, height: physicalCell! * sheet.height }
      : sheetLayout(sheet, box.w, box.h);
  const fitKey = `${fit.fits}:${fit.rows}`;
  useEffect(() => {
    if (plateMode) onFit?.(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, plateMode]);
  const clamped = clampTransform(zoom, layout.width, layout.height, box.w, box.h);
  // 値が同じなら同じオブジェクトを使う（タッチの受け取りを毎回作り直さないように）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => clamped, [clamped.scale, clamped.tx, clamped.ty]);

  // PanResponder のコールバックは描画中ではなくジェスチャー中に ref を読む。React Compiler の規則が
  // useMemo 内のクロージャーまで「描画中のアクセス」と判定するため、このブロックだけ無効にする（CropBox と同じ）。
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const responder = useMemo(() => {
    const rel = (x: number, y: number): Pt => ({ x: x - origin.current.x, y: y - origin.current.y });
    const touchesOf = (e: GestureResponderEvent): TouchPoint[] => {
      const ne = e.nativeEvent;
      // Web のマウス操作では touches が空のことがあるので、イベント自身の座標を使う
      if (!ne.touches || ne.touches.length === 0) return [{ id: Number(ne.identifier ?? 0), p: rel(ne.pageX, ne.pageY) }];
      return ne.touches.map((tt) => ({ id: Number(tt.identifier), p: rel(tt.pageX, tt.pageY) }));
    };
    const cellAt = (p: Pt): Cell | null => {
      if (!sheet || !full) return null;
      const c = toContent(t, p);
      const v = viewToCell(c.x, c.y, sheet, layout.cell, mirror);
      if (!v) return null;
      const x = v[0] + offset.x;
      const y = v[1] + offset.y;
      // 13/21 マスの作品をプレートに置いたとき、作品の外のマスは塗れない
      return x < full.width && y < full.height ? [x, y] : null;
    };
    const st = () => editorStore().getState();
    /** ペン・消しゴム・範囲選択は begin/move/end、バケツと1マス選択はタップで実行する。 */
    const isDrag = () => {
      const s = st();
      return s.tool === 'pen' || s.tool === 'eraser' || (s.tool === 'select' && s.rangeMode);
    };
    const run = (actions: TouchAction[]) => {
      for (const a of actions) {
        const s = st();
        switch (a.type) {
          case 'begin':
            if (!isDrag()) break;
            if (s.tool === 'select') s.tapSelect(cellAt(a.p));
            else s.strokeBegin(cellAt(a.p));
            break;
          case 'move':
            if (!isDrag()) break;
            if (s.tool === 'select') s.rangeMove(cellAt(a.p));
            else s.strokeMove(cellAt(a.p));
            break;
          case 'end':
            if (!isDrag()) break;
            if (s.tool === 'select') s.rangeEnd();
            else s.strokeEnd();
            break;
          case 'tap':
            if (isDrag()) break;
            if (s.tool === 'bucket') s.bucket(cellAt(a.p));
            else s.tapSelect(cellAt(a.p));
            break;
          case 'pinchStart':
            pinchStart.current = { t, a: a.a, b: a.b };
            break;
          case 'pinch':
            if (pinchStart.current) {
              const ps = pinchStart.current;
              setZoom(clampTransform(pinch(ps.t, ps.a, ps.b, a.a, a.b), layout.width, layout.height, box.w, box.h));
            }
            break;
          case 'resetZoom':
            setZoom(IDENTITY);
            break;
        }
      }
    };
    const clearHold = () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !melted,
      onMoveShouldSetPanResponder: () => !melted,
      onPanResponderGrant: (e) => {
        viewRef.current?.measureInWindow((x: number, y: number) => (origin.current = { x, y }));
        const [first] = touchesOf(e);
        run(tracker.current.start(first.id, first.p, Date.now()));
        clearHold();
        if (CAN_ZOOM) holdTimer.current = setTimeout(() => run(tracker.current.tick(Date.now())), HOLD_MS);
      },
      onPanResponderMove: (e) => run(tracker.current.move(touchesOf(e), Date.now())),
      onPanResponderRelease: () => {
        clearHold();
        run(tracker.current.end(Date.now()));
      },
      onPanResponderTerminate: () => {
        clearHold();
        run(tracker.current.end(Date.now()));
      },
    });
  }, [sheet, full, offset.x, offset.y, t, layout.cell, layout.width, layout.height, box.w, box.h, mirror, melted]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const onLayout = (e: LayoutChangeEvent) => {
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
    viewRef.current?.measureInWindow((x: number, y: number) => (origin.current = { x, y }));
  };

  return (
    <View ref={viewRef} testID="editor-canvas" style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout} {...responder.panHandlers}>
      {fit.fits === 'none' ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.subtext, textAlign: 'center', marginTop: 40 }}>iPad を横向きにしてください（プレートが画面に入りません）</Text>
      ) : sheet && layout.cell > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: layout.width,
            height: layout.height,
            transformOrigin: 'top left',
            transform: [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.scale }],
          }}>
          <SheetCanvas
            sheet={sheet}
            width={layout.width}
            height={layout.height}
            mirror={mirror}
            styleMode={melted ? 'melted' : 'bead'}
            version={version}
            exactCell={plateMode ? layout.cell : undefined}
          />
          {!melted && full && (
            <SelectionOverlay sheet={sheet} cell={layout.cell} mirror={mirror} cells={toLocal(selection, full.width, offset, sheet)} rect={rangeLocal(range, offset)} />
          )}
        </View>
      )}
    </View>
  );
}

/** シート全体のマス番号 → 表示しているシート（プレート）のマス番号。表示範囲外は除く。 */
function toLocal(sel: ReadonlySet<number>, fullW: number, off: { x: number; y: number }, view: Sheet): ReadonlySet<number> {
  if (off.x === 0 && off.y === 0 && view.width === fullW) return sel;
  const out = new Set<number>();
  for (const i of sel) {
    const x = (i % fullW) - off.x;
    const y = Math.floor(i / fullW) - off.y;
    if (x >= 0 && y >= 0 && x < view.width && y < view.height) out.add(y * view.width + x);
  }
  return out;
}

function rangeLocal(r: [Cell, Cell] | null, off: { x: number; y: number }): [Cell, Cell] | null {
  if (!r) return null;
  return [
    [r[0][0] - off.x, r[0][1] - off.y],
    [r[1][0] - off.x, r[1][1] - off.y],
  ];
}
