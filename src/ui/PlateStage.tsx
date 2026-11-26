import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { fitPlate, halfRows, type PhonePhysical, phonePhysical, PLATE_CELLS } from '@/core/physical';
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
  /** iPhone の実寸表示の結果が変わったら知らせる（入らないときに画面が注意書きを出す） */
  onPhonePhysical?(p: PhonePhysical): void;
  testID?: string;
}

/** プレート1枚を描く。iPad は実寸（ズーム・移動なし）、iPhone は箱に収める。 */
export function PlateStage({ sheet, plate, focus, mirror, half = 0, version, onFit, onPhonePhysical, testID }: Props) {
  const dev = useDeviceLayout();
  const [box, setBox] = useState({ w: 0, h: 0 });
  let fit: PlateFit = { fits: 'full', rows: PLATE_CELLS };
  let cell = box.w > 0 ? Math.min(box.w, box.h) / PLATE_CELLS : 0;
  if (dev.physicalCell && box.w > 0) {
    cell = dev.physicalCell;
    fit = fitPlate(cell, box.w, box.h);
  }
  // iPhone：13×13 の作品は、29×29 のプレートではなく作品だけを実寸で描く
  const phone = phonePhysical({ phoneCell: dev.isPad ? null : dev.phoneCell, sheetW: sheet.width, sheetH: sheet.height, boxW: box.w, boxH: box.h });
  const exact = phone === 'exact';
  useEffect(() => {
    onPhonePhysical?.(phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);
  if (exact) cell = dev.phoneCell!;
  const rows = fit.fits === 'half' ? halfRows(half, fit.rows) : ([0, PLATE_CELLS] as [number, number]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sub = useMemo(() => (exact ? sheet : plateSheet(sheet, plate, rows)), [exact, sheet, plate, rows[0], rows[1], version]);

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
          <SheetCanvas
            testID="nav-sheet"
            sheet={sub}
            width={cell * sub.width}
            height={cell * sub.height}
            mirror={mirror}
            focus={focus}
            version={version}
            exactCell={dev.physicalCell || exact ? cell : undefined}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msg: { fontFamily: fonts.bold, fontSize: 17, color: colors.subtext, textAlign: 'center', padding: 24 },
});
