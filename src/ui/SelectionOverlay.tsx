import { Canvas, DashPathEffect, Group, Rect } from '@shopify/react-native-skia';

import type { Cell } from '@/core/sheet/ops';
import type { Sheet } from '@/core/sheet/sheet';

import { colors } from './theme';

interface Props {
  sheet: Sheet;
  cell: number;
  mirror: boolean;
  cells: ReadonlySet<number>;
  /** 範囲選択中の2点（シート座標） */
  rect?: [Cell, Cell] | null;
}

/** 選択したマスと範囲選択の矩形を、シートの上に重ねて描く（シート本体は描き直さない）。 */
export function SelectionOverlay({ sheet, cell, mirror, cells, rect }: Props) {
  const W = sheet.width * cell;
  const H = sheet.height * cell;
  const mx = (x: number) => (mirror ? sheet.width - 1 - x : x);
  let r: { x: number; y: number; w: number; h: number } | null = null;
  if (rect) {
    const [a, b] = rect;
    const x0 = Math.min(mx(a[0]), mx(b[0]));
    const x1 = Math.max(mx(a[0]), mx(b[0]));
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);
    r = { x: x0 * cell, y: y0 * cell, w: (x1 - x0 + 1) * cell, h: (y1 - y0 + 1) * cell };
  }
  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} pointerEvents="none">
      <Group>
        {[...cells].map((i) => {
          const x = i % sheet.width;
          const y = (i - x) / sheet.width;
          return <Rect key={i} x={mx(x) * cell + 1} y={y * cell + 1} width={cell - 2} height={cell - 2} color={colors.accent} style="stroke" strokeWidth={2} />;
        })}
        {r && (
          <Rect x={r.x} y={r.y} width={r.w} height={r.h} color={colors.accent} style="stroke" strokeWidth={2}>
            <DashPathEffect intervals={[6, 4]} />
          </Rect>
        )}
      </Group>
    </Canvas>
  );
}
