import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { fitPlate, halfRows, PLATE_CELLS } from '@/core/physical';
import { type Plate, plateSheet } from '@/core/sheet/plates';
import type { Sheet } from '@/core/sheet/sheet';

import { SheetCanvas } from './SheetCanvas';
import { colors, fonts } from './theme';
import { useDeviceLayout } from './useDeviceLayout';

export type PlateFit = { fits: 'full' | 'half' | 'none'; rows: number };

interface Props {
  sheet: Sheet;
  plate: Plate;
  focus?: number;
  mirror?: boolean;
  half?: 0 | 1;
  version?: number;
  /** 半分表示などの状態を、使う側（パネル）に知らせる */
  onFit?(fit: PlateFit): void;
  testID?: string;
}

/** プレート1枚を描く。iPad は実寸（ズーム・移動なし）、iPhone は箱に収める。 */
export function PlateStage({ sheet, plate, focus, mirror, half = 0, version, onFit, testID }: Props) {
  const dev = useDeviceLayout();
  const [box, setBox] = useState({ w: 0, h: 0 });
  let fit: PlateFit = { fits: 'full', rows: PLATE_CELLS };
  let cell = box.w > 0 ? Math.min(box.w, box.h) / PLATE_CELLS : 0;
  if (dev.physicalCell && box.w > 0) {
    cell = dev.physicalCell;
    fit = fitPlate(cell, box.w, box.h);
  }
  const rows = fit.fits === 'half' ? halfRows(half, fit.rows) : ([0, PLATE_CELLS] as [number, number]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sub = useMemo(() => plateSheet(sheet, plate, rows), [sheet, plate, rows[0], rows[1], version]);

  // 大きさ・補正係数が変わるたびに、半分表示かどうかを使う側へ知らせる
  const fitKey = `${fit.fits}:${fit.rows}`;
  useEffect(() => {
    onFit?.(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.box} onLayout={onLayout} testID={testID}>
      {fit.fits === 'none' ? (
        <Text style={styles.msg}>iPad を横向きにしてください（プレートが画面に入りません）</Text>
      ) : (
        cell > 0 && (
          <SheetCanvas sheet={sub} width={cell * PLATE_CELLS} height={cell * (rows[1] - rows[0])} mirror={mirror} focus={focus} version={version} exactCell={dev.physicalCell ? cell : undefined} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msg: { fontFamily: fonts.bold, fontSize: 17, color: colors.subtext, textAlign: 'center', padding: 24 },
});
