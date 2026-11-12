// Web（自動テスト用）: CanvasKit（public/canvaskit.wasm）を読み込む。
// 画面フォルダ（src/app）に .web.tsx を置くと iOS のビルドにも混ざるため、ここ（src/platform）で切り替える。
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export function loadSkia(): Promise<void> {
  return LoadSkiaWeb({ locateFile: (file) => `/${file}` });
}
