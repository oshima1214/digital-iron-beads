/**
 * iOS のスワイプで戻る操作を止める画面。
 * ペンでなぞる・プレートを置く・切り抜き枠を動かす画面では、
 * 左端からのドラッグが「戻る」と誤認されるため止める（戻るのは左上のボタン）。
 */
export const NO_SWIPE_BACK_ROUTES = ['project/[id]', 'nav/[id]', 'new/prepare'] as const;
