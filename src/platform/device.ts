import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** iPad かどうか。Web（自動テスト用）は URL に ?pad=1 があるときだけ iPad として扱う。 */
export const isPad: boolean =
  Platform.OS === 'web' ? typeof location !== 'undefined' && /[?&]pad=1\b/.test(location.search) : Platform.OS === 'ios' && Platform.isPad;
export const isWeb = Platform.OS === 'web';
export const modelId: string | null = isWeb ? null : Device.modelId;
export const modelName: string | null = isWeb ? null : Device.modelName;

/** Web（自動テスト用）：?ppi=163 などで画面の細かさを指定できる（iPad mini の再現用）。 */
export const webPpi: number | null =
  Platform.OS === 'web' && typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('ppi')) || null : null;
