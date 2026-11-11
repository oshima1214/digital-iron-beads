import { useWindowDimensions } from 'react-native';

import { cellPt, ptPerInchFor } from '@/core/physical';
import { isPad, isWeb, modelId, modelName } from '@/platform/device';
import { useSettings } from '@/state/settings';

const density = ptPerInchFor(modelId, modelName, isWeb);

export interface DeviceLayout {
  isPad: boolean;
  landscape: boolean;
  /** iPad のときだけ：実寸の1マスの大きさ（pt） */
  physicalCell: number | null;
  panelSide: 'left' | 'right';
  /** 実寸の微調整が必要か（機種が推測で、まだ調整していない） */
  needsCalibration: boolean;
}

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  const settings = useSettings((s) => s.settings);
  return {
    isPad,
    landscape: width > height,
    physicalCell: isPad ? cellPt(density.ptPerInch, settings.calibration) : null,
    panelSide: settings.panelSide,
    needsCalibration: isPad && !settings.calibrated && !density.known,
  };
}

export { density };
