import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, Platform, View } from 'react-native';

import type { Cell } from '@/core/sheet/ops';
import { editorStore, useEditor } from '@/state/editor';

import { SelectionOverlay } from '../SelectionOverlay';
import { SheetCanvas } from '../SheetCanvas';
import { sheetLayout, viewToCell } from '../sheetGeometry';
import { clampTransform, IDENTITY, pinch, type Pt, toContent, type Transform } from '../zoom';
import { createTouchTracker, HOLD_MS, type TouchAction, type TouchPoint } from './touchTracker';

/** iPhone だけピンチズームとドラッグでの移動を許す（iPad はプレートを重ねるので動かさない）。 */
const CAN_ZOOM = Platform.OS === 'ios' && !Platform.isPad;

/** 値の変化を1フレームに1回までにまとめる（塗るたびにシート全体を描き直さないように）。 */
function useFrameThrottled<T>(value: T): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return shown;
}

export function EditorCanvas() {
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

  const sheet = project?.sheet;
  const layout = sheet ? sheetLayout(sheet, box.w, box.h) : { cell: 0, width: 0, height: 0 };
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
      if (!sheet) return null;
      const c = toContent(t, p);
      return viewToCell(c.x, c.y, sheet, layout.cell, mirror);
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
  }, [sheet, t, layout.cell, layout.width, layout.height, box.w, box.h, mirror, melted]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const onLayout = (e: LayoutChangeEvent) => {
    setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
    viewRef.current?.measureInWindow((x: number, y: number) => (origin.current = { x, y }));
  };

  return (
    <View ref={viewRef} testID="editor-canvas" style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout} {...responder.panHandlers}>
      {sheet && layout.cell > 0 && (
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
          <SheetCanvas sheet={sheet} width={layout.width} height={layout.height} mirror={mirror} styleMode={melted ? 'melted' : 'bead'} version={version} />
          {!melted && <SelectionOverlay sheet={sheet} cell={layout.cell} mirror={mirror} cells={selection} rect={range} />}
        </View>
      )}
    </View>
  );
}
