/**
 * アプリの識別子（App Store に提出すると変えられないもの）。
 * TODO(M6): オーナーにアプリ ID を確認する（現在は仮の値）。app.json の ios.bundleIdentifier と UTI も合わせて変える。
 */
export const BUNDLE_ID = 'com.oshima1214.digitalironbeads';
export const BEADS_UTI = `${BUNDLE_ID}.beads`;
export const BEADS_EXT = 'beads';
export const BEADS_MIME = 'application/x-digital-iron-beads';
