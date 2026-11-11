import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { clampCrop, type CropRect } from '@/core/image/adjust';

import { colors } from './theme';

type Handle = 'move' | 'tl' | 'tr' | 'bl' | 'br';
const HANDLE = 32;

interface Props {
  /** 元画像のピクセル寸法 */
  imgW: number;
  imgH: number;
  /** 表示している大きさ（px） */
  displayW: number;
  displayH: number;
  rect: CropRect;
  onChange(rect: CropRect): void;
}

/** 画像の上に重ねる切り抜き枠。4隅で大きさを変え、中をドラッグで移動する。 */
export function CropBox({ imgW, imgH, displayW, displayH, rect, onChange }: Props) {
  // ドラッグ中だけ一時的な枠を持ち、離したら onChange で確定する（表示は drag ?? rect）。
  const [drag, setDrag] = useState<CropRect | null>(null);
  const startRef = useRef(rect);
  const liveRef = useRef<CropRect | null>(null);
  const scale = imgW / displayW;

  // PanResponder のコールバックは描画中ではなくジェスチャー中に ref を読む。React Compiler の規則が
  // useMemo 内のクロージャーまで「描画中の ref アクセス」と判定するため、このブロックだけ無効にする。
  /* eslint-disable react-hooks/refs */
  const responders = useMemo(() => {
    const finish = () => {
      if (liveRef.current) onChange(liveRef.current);
      liveRef.current = null;
      setDrag(null);
    };
    const make = (h: Handle) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = rect;
          liveRef.current = rect;
        },
        onPanResponderMove: (_, g) => {
          const s = startRef.current;
          const dx = g.dx * scale;
          const dy = g.dy * scale;
          let next: CropRect;
          if (h === 'move') next = { ...s, x: Math.min(Math.max(0, s.x + dx), imgW - s.w), y: Math.min(Math.max(0, s.y + dy), imgH - s.h) };
          else {
            const left = h === 'tl' || h === 'bl' ? s.x + dx : s.x;
            const top = h === 'tl' || h === 'tr' ? s.y + dy : s.y;
            const right = h === 'tr' || h === 'br' ? s.x + s.w + dx : s.x + s.w;
            const bottom = h === 'bl' || h === 'br' ? s.y + s.h + dy : s.y + s.h;
            next = { x: Math.min(left, right), y: Math.min(top, bottom), w: Math.abs(right - left), h: Math.abs(bottom - top) };
          }
          next = clampCrop(next, imgW, imgH);
          liveRef.current = next;
          setDrag(next);
        },
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      });
    return { move: make('move'), tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, [rect, imgW, imgH, scale, onChange]);
  /* eslint-enable react-hooks/refs */

  const live = drag ?? rect;
  const x = live.x / scale;
  const y = live.y / scale;
  const w = live.w / scale;
  const h = live.h / scale;
  const corner = (k: 'tl' | 'tr' | 'bl' | 'br', left: number, top: number) => (
    <View
      key={k}
      testID={`crop-${k}`}
      {...responders[k].panHandlers}
      style={[styles.handle, { left: left - HANDLE / 2, top: top - HANDLE / 2 }]}>
      <View style={styles.handleDot} />
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, { width: displayW, height: displayH }]} pointerEvents="box-none">
      <View style={[styles.shade, { left: 0, top: 0, width: displayW, height: y }]} />
      <View style={[styles.shade, { left: 0, top: y + h, width: displayW, height: displayH - y - h }]} />
      <View style={[styles.shade, { left: 0, top: y, width: x, height: h }]} />
      <View style={[styles.shade, { left: x + w, top: y, width: displayW - x - w, height: h }]} />
      <View testID="crop-body" {...responders.move.panHandlers} style={[styles.frame, { left: x, top: y, width: w, height: h }]} />
      {corner('tl', x, y)}
      {corner('tr', x + w, y)}
      {corner('bl', x, y + h)}
      {corner('br', x + w, y + h)}
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.35)' },
  frame: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.accent },
});
