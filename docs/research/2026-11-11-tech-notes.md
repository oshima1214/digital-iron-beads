# 技術メモ（2026-11-11 時点の下調べ）

仕様書 `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md` を補足するための調査結果です。

## 1. ライブラリのバージョン（npm で確認、2026-11-11 時点）

| パッケージ | 最新版 | 備考 |
|---|---|---|
| expo | 58.0.23（`latest`、SDK 58） | M0 では SDK 58 を使う |
| expo-router | 58.0.30 | SDK 58 に対応 |
| @shopify/react-native-skia | 2.14.0 | 依存：react 19 以上、react-native 0.78 以上、reanimated 4 以上、react-native-worklets 0.7 以上 |
| react-native-reanimated | 4.7.1 | |
| react-native-gesture-handler | 3.5.0 | |
| zustand | 5.1.0 | |
| fflate | 0.8.3 | |
| expo-print / expo-device | 58.x | |
| @expo-google-fonts/biz-udpgothic | 0.4.2 | ライセンスは MIT と OFL-1.1 |

実際に入れるバージョンは、M0 で `npx expo install` を使い、SDK 58 と互換性のある組み合わせに固定する。

## 2. フォント（BIZ UDPゴシック）
- `googlefonts/morisawa-biz-ud-gothic` で、SIL Open Font License 1.1 として配布されている
- OFL では、フォントをアプリに同梱して配布できる（商用も可）。禁止されているのは、フォント単体を販売することだけ
- `@expo-google-fonts/biz-udpgothic` で入れる
- ライセンス表記を、設定画面の「クレジット」に載せる

## 3. App Store の Kids カテゴリー（ガイドライン 1.3 / 5.1.4）
- 外部へのリンク、課金、気が散る要素は、ペアレンタルゲートの奥に置くこと
- 外部の広告や分析ツールは原則として使わない（例外の条件は細かい）。このアプリは**外部 SDK を一切入れない**ので、問題にならない
- 個人を特定できる情報や端末の情報を、第三者に送らないこと。このアプリは通信しないので該当しない
- プライバシーポリシーの URL が必須。M6 で GitHub Pages に置く
- 申請する前に、Apple の最新のガイドラインの原文を必ず確認すること（二次情報には古い記述が多いため）

## 4. iPad の実寸表示（ポイント密度）
- 現行の iPad は、mini 以外すべて **264ppi（2倍スケール）= 132pt/inch**（iPad、Air、Pro。OLED の Pro も 264ppi）
- **iPad mini は 326ppi = 163pt/inch**
- 方針
  - `expo-device` の `modelId`（例：`iPad14,1`）で、わかっている機種は表から引く
  - 表にない機種は、`modelName` に "mini" を含むかどうかで 163 か 132 を仮に選び、**初めて使うときに微調整画面へ誘導**する
  - 補正係数で、OS や機種ごとの細かい誤差を吸収する
- 29マス = 145mm の必要ポイント数：132pt/inch で約753.5pt、163pt/inch で約930.5pt
  - 11インチ級の iPad（短い辺が約820〜834pt）：縦向きでも横向きでも1枚収まる
  - 13インチ級：余裕がある
  - **iPad mini**（744×1133pt）：短い辺が744pt で、必要な930.5pt に**足りない**。横向きでも高さが744pt なので、「上半分 / 下半分」の切り替えが必要（仕様書 §6.3 のとおり）

## 5. 未確認のリスク
- **パーラーの色の RGB 値**：元のコードの値をそのまま使う。公式の色見本と照らし合わせて合っているかは、まだ確認していない。実物のビーズを撮影して補正するかどうかは、M1 以降に検討する
- **Skia の Web 版（CanvasKit）**での表示速度：Playwright での確認に使う範囲であれば問題ない見込み
