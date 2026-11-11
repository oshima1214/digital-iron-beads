import { useWindowDimensions } from 'react-native';

import { cellPt, chooseStageLayout, ptPerInchFor } from '@/core/physical';
import { isPad, isWeb, modelId, modelName, webPpi } from '@/platform/device';
import { useSettings } from '@/state/settings';

/** iPad 横向きで横に置くパネルの幅 */
export const SIDE_PANEL_W = 360;

const density = webPpi ? { ptPerInch: webPpi, known: true } : ptPerInchFor(modelId, modelName, isWeb);

export interface DeviceLayout {
  isPad: boolean;
  landscape: boolean;
  /** iPad のときだけ：実寸の1マスの大きさ（pt） */
  physicalCell: number | null;
  /** iPad の画面配置：side = 左右、stacked = パネルが上、compact = 上に1行の薄いパネル */
  stage: 'side' | 'stacked' | 'compact';
  panelSide: 'left' | 'right';
  /** 実寸の微調整が必要か（機種が推測で、まだ調整していない） */
  needsCalibration: boolean;
}

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  const settings = useSettings((s) => s.settings);
  const physicalCell = isPad ? cellPt(density.ptPerInch, settings.calibration) : null;
  return {
    isPad,
    landscape: width > height,
    physicalCell,
    stage: physicalCell ? chooseStageLayout({ winW: width, winH: height, cell: physicalCell, panelW: SIDE_PANEL_W }) : 'stacked',
    panelSide: settings.panelSide,
    needsCalibration: isPad && !settings.calibrated && !density.known,
  };
}

export { density };
