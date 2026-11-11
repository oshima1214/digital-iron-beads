import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, Platform, View } from 'react-native';

import type { Cell } from '@/core/sheet/ops';
import { editorStore, useEditor } from '@/state/editor';

import { SelectionOverlay } from '../SelectionOverlay';
import { SheetCanvas } from '../SheetCanvas';
import { sheetLayout, viewToCell } from '../sheetGeometry';
import { clampTransform, IDENTITY, pinch, type Pt, toContent, type Transform } from '../zoom';

/** iPhone だけピンチズームとドラッグでの移動を許す（iPad はプレートを重ねるので動かさない）。 */
const CAN_ZOOM = Platform.OS === 'ios' && !Platform.isPad;
const DOUBLE_TAP_MS = 300;

type Mode = 'idle' | 'tool' | 'pinch';

export function EditorCanvas() {
  const project = useEditor((s) => s.project);
  const version = useEditor((s) => s.version);
  const mirror = useEditor((s) => s.mirror);
  const melted = useEditor((s) => s.melted);
  const selection = useEditor((s) => s.selection);
  const range = useEditor((s) => s.range);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<Transform>(IDENTITY);
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const gesture = useRef<{ mode: Mode; start: Transform; a0: Pt; b0: Pt; lastTap: number; moved: boolean }>({
    mode: 'idle',
    start: IDENTITY,
    a0: { x: 0, y: 0 },
    b0: { x: 0, y: 0 },
    lastTap: 0,
    moved: false,
  });

  const sheet = project?.sheet;
  const layout = sheet ? sheetLayout(sheet, box.w, box.h) : { cell: 0, width: 0, height: 0 };
  const t = clampTransform(zoom, layout.width, layout.height, box.w, box.h);

  // PanResponder のコールバックは描画中ではなくジェスチャー中に ref と Date.now を読む。React Compiler の規則が
  // useMemo 内のクロージャーまで「描画中のアクセス」と判定するため、このブロックだけ無効にする（CropBox と同じ）。
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const responder = useMemo(() => {
    const point = (e: GestureResponderEvent, k = 0): Pt => {
      const touch = e.nativeEvent.touches[k] ?? e.nativeEvent;
      return { x: touch.pageX - origin.current.x, y: touch.pageY - origin.current.y };
    };
    const cellAt = (p: Pt): Cell | null => {
      if (!sheet) return null;
      const c = toContent(t, p);
      return viewToCell(c.x, c.y, sheet, layout.cell, mirror);
    };
    const st = () => editorStore().getState();
    const toolBegin = (c: Cell | null) => {
      const s = st();
      if (s.tool === 'pen' || s.tool === 'eraser') s.strokeBegin(c);
      else if (s.tool === 'bucket') s.bucket(c);
      else s.tapSelect(c);
    };
    const toolMove = (c: Cell | null) => {
      const s = st();
      if (s.tool === 'pen' || s.tool === 'eraser') s.strokeMove(c);
      else if (s.tool === 'select' && s.rangeMode) s.rangeMove(c);
    };
    const toolEnd = () => {
      const s = st();
      if (s.tool === 'pen' || s.tool === 'eraser') s.strokeEnd();
      else if (s.tool === 'select' && s.rangeMode) s.rangeEnd();
    };
    const startPinch = (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (g.mode === 'tool') toolEnd(); // 2本目の指が置かれたら塗りかけを確定し、以降は塗らない
      g.mode = 'pinch';
      g.start = t;
      g.a0 = point(e, 0);
      g.b0 = point(e, 1);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !melted,
      onMoveShouldSetPanResponder: () => !melted,
      onPanResponderGrant: (e) => {
        viewRef.current?.measureInWindow((x: number, y: number) => (origin.current = { x, y }));
        const g = gesture.current;
        g.moved = false;
        if (CAN_ZOOM && e.nativeEvent.touches.length >= 2) return startPinch(e);
        g.mode = 'tool';
        toolBegin(cellAt(point(e)));
      },
      onPanResponderMove: (e) => {
        const g = gesture.current;
        g.moved = true;
        if (CAN_ZOOM && e.nativeEvent.touches.length >= 2) {
          if (g.mode !== 'pinch') return startPinch(e);
          setZoom(clampTransform(pinch(g.start, g.a0, g.b0, point(e, 0), point(e, 1)), layout.width, layout.height, box.w, box.h));
          return;
        }
        if (g.mode === 'tool') toolMove(cellAt(point(e)));
      },
      onPanResponderRelease: () => {
        const g = gesture.current;
        if (g.mode === 'tool') toolEnd();
        if (CAN_ZOOM && g.mode === 'tool' && !g.moved) {
          const now = Date.now();
          if (now - g.lastTap < DOUBLE_TAP_MS) setZoom(IDENTITY); // ダブルタップでズームを戻す
          g.lastTap = now;
        }
        g.mode = 'idle';
      },
      onPanResponderTerminate: () => {
        if (gesture.current.mode === 'tool') toolEnd();
        gesture.current.mode = 'idle';
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
