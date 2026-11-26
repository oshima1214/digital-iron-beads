import { useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, Platform, View } from 'react-native';

import { fitPlate, type PhonePhysical, phonePhysical, PLATE_CELLS } from '@/core/physical';
import { type Plate, plateSheet } from '@/core/sheet/plates';
import type { Project } from '@/core/file/project';
import type { Sheet } from '@/core/sheet/sheet';

import type { Cell } from '@/core/sheet/ops';
import { editorStore, useEditor } from '@/state/editor';

import { SelectionOverlay } from '../SelectionOverlay';
import { SheetCanvas } from '../SheetCanvas';
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
  /** 描く作品（ふだんはストアの作品。画面を離れる途中は、閉じる前の作品） */
  project: Project;
  /** 触れない（画面を離れる途中） */
  readOnly?: boolean;
  /** iPad：このプレートだけを実寸で描く（null ならシート全体） */
  plate?: Plate | null;
  /** iPad：実寸の1マスの大きさ */
  physicalCell?: number | null;
  /** iPhone：実寸の1マスの大きさ（13×13 の作品だけ実寸で描く。core/physical の phonePhysical） */
  phoneCell?: number | null;
  /** iPhone の実寸表示の結果が変わったら知らせる（入らないときに画面が注意書きを出す） */
  onPhonePhysical?(p: PhonePhysical): void;
}

export function EditorCanvas({ project, readOnly = false, plate = null, physicalCell = null, phoneCell = null, onPhonePhysical }: Props) {
  const liveVersion = useEditor((s) => s.version);
  const version = useFrameThrottled(liveVersion);
  const mirror = useEditor((s) => s.mirror);
  const melted = useEditor((s) => s.melted);
  const selection = useEditor((s) => s.selection);
  const range = useEditor((s) => s.range);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<Transform>(IDENTITY);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchStart = useRef<{ t: Transform; a: Pt; b: Pt } | null>(null);

  const full = project.sheet;
  // iPad はプレート1枚（半分表示なら一部の行）だけを実寸で描き、マス座標にプレートの原点を足す
  const plateMode = !!(plate && physicalCell && full);
  // 編集は実物を重ねないので、プレートが実寸で丸ごと入らないとき（iPad mini など）は箱に収めて表示する
  const physicalFits = plateMode && box.w > 0 && fitPlate(physicalCell!, box.w, box.h).fits === 'full';
  const plateCell = physicalFits ? physicalCell! : Math.min(box.w, box.h) / PLATE_CELLS;
  const rows: [number, number] = [0, PLATE_CELLS];
  const sheet = useMemo(
    () => (plateMode ? plateSheet(full!, plate!, rows) : full),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [full, plateMode, plate, rows[0], rows[1], version],
  );
  // iPhone：13×13 の作品が画面に入るなら実寸で描き、ズーム・移動はしない（iPad と同じ）
  const phone = plateMode ? 'off' : phonePhysical({ phoneCell, sheetW: full.width, sheetH: full.height, boxW: box.w, boxH: box.h });
  const exact = phone === 'exact';
  useEffect(() => {
    onPhonePhysical?.(phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);
  const canZoom = CAN_ZOOM && !exact;
  const tracker = useMemo(() => createTouchTracker(canZoom), [canZoom]);
  if (exact && zoom !== IDENTITY) setZoom(IDENTITY);
  const offset = plateMode ? { x: plate!.originX, y: plate!.originY + rows[0] } : { x: 0, y: 0 };
  const layout = !sheet
    ? { cell: 0, width: 0, height: 0 }
    : plateMode
      ? { cell: plateCell, width: plateCell * sheet.width, height: plateCell * sheet.height }
      : exact
        ? { cell: phoneCell!, width: phoneCell! * sheet.width, height: phoneCell! * sheet.height }
        : sheetLayout(sheet, box.w, box.h);

  const clamped = clampTransform(zoom, layout.width, layout.height, box.w, box.h);
  // 値が同じなら同じオブジェクトを使う（タッチの受け取りを毎回作り直さないように）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(() => clamped, [clamped.scale, clamped.tx, clamped.ty]);

  // PanResponder のコールバックは描画中ではなくジェスチャー中に ref を読む。React Compiler の規則が
  // useMemo 内のクロージャーまで「描画中のアクセス」と判定するため、このブロックだけ無効にする（CropBox と同じ）。
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const responder = useMemo(() => {
    // 座標はこの View の左上からの位置（locationX/Y）を使う。子はタッチを受けない（box-only）ので、
    // いつもこの View が基準になる。画面の位置を測って引く方法は、測るのが非同期で、画面が動いた直後
    // （画面の切り替えのアニメーション中など）に古い位置を使い、タップの位置がずれることがあった。
    const touchesOf = (e: GestureResponderEvent): TouchPoint[] => {
      const ne = e.nativeEvent;
      // Web のマウス操作では touches が空のことがあるので、イベント自身の座標を使う
      if (!ne.touches || ne.touches.length === 0) return [{ id: Number(ne.identifier ?? 0), p: { x: ne.locationX, y: ne.locationY } }];
      return ne.touches.map((tt) => ({ id: Number(tt.identifier), p: { x: tt.locationX, y: tt.locationY } }));
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
        const [first] = touchesOf(e);
        run(tracker.start(first.id, first.p, Date.now()));
        clearHold();
        if (canZoom) holdTimer.current = setTimeout(() => run(tracker.tick(Date.now())), HOLD_MS);
      },
      onPanResponderMove: (e) => run(tracker.move(touchesOf(e), Date.now())),
      onPanResponderRelease: () => {
        clearHold();
        run(tracker.end(Date.now()));
      },
      onPanResponderTerminate: () => {
        clearHold();
        run(tracker.end(Date.now()));
      },
    });
  }, [tracker, canZoom, sheet, full, offset.x, offset.y, t, layout.cell, layout.width, layout.height, box.w, box.h, mirror, melted]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const onLayout = (e: LayoutChangeEvent) => {
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

  return (
    <View testID="editor-canvas" pointerEvents={readOnly ? 'none' : 'box-only'} style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout} {...responder.panHandlers}>
      {sheet && layout.cell > 0 && (
        <View
          testID="editor-sheet"
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
            exactCell={plateMode || exact ? layout.cell : undefined}
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
