# デジタル・アイロンビーズ

アイロンビーズ制作支援アプリ。Google Colab + Gradio 版 (V7) を Expo (React Native) で iOS アプリ化し、App Store でのリリースを目指す。

- 設計仕様書: `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md`
- 実装計画: `docs/superpowers/plans/`
- `legacy/` … 元の Colab 版ソース（参照用・改変しない。ブランチ `legacy/colab-v7` にも保存）

## 開発

```bash
npm install
npm run typecheck   # 型チェック
npm run lint        # ESLint（src/core は React Native 非依存を強制）
npm test            # Jest
npm run web:export  # Web 版を dist/ に出力（自動テスト用）
npm run e2e:web     # Web 版の E2E（Playwright。この開発環境ではグローバルの playwright を使う）
npm start           # 開発サーバ
```

比較ハーネス（M1 で追加）: `npm run fixtures && npm run compare` → `tools/compare/out/index.html`

## 実機での確認

### Expo Go + EAS Update（PC やサーバーを動かさずに、どこからでも開く）

1. iPhone の Expo Go に、Expo の組織 `digital-iron-beads-team` のメンバーのアカウントでログインしておく（メンバーでないと開けない）
2. PC で配信する（`runtimeVersion` は Expo Go で動くよう `sdkVersion` にしてある）

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "説明"
```

3. 表示された URL（expo.dev の更新ページ）を開き、「Preview」の QR コードを iPhone で読む

開けるのは、組織 `digital-iron-beads-team` のメンバーとして Expo Go にログインしている人だけです（Expo Go の制限。Expo CLI 側もログインが必要）。ほかの人に試してもらうには、expo.dev の組織のページ → Members → Invite で招待するか、TestFlight などで配ります。


Skia などのネイティブモジュールを使うため、Expo Go ではなく開発用ビルドで動かします。マイルストーンごとの確認項目は `docs/checklists/` にあります。

## ビルド・提出（EAS）

EAS Build / Submit には Expo アカウントが必要です（`npx eas-cli@latest login`）。
App Store 提出には Apple Developer Program への登録が必要です。

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```
