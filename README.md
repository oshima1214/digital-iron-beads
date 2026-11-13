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

Expo Go（App Store の無料アプリ）の中で、iPhone・iPad のネイティブアプリとして動かせる。開ける人の条件は方法によって違う（2026年11月に確認）。

| 方法 | 開ける人 | PC・Pi |
|---|---|---|
| EAS Update の配信 | 組織 `digital-iron-beads-team` のメンバー（自分のアカウントで Expo Go にログイン） | 不要 |
| 開発サーバー（`npx expo start --tunnel`） | Expo CLI と**同じアカウント**で Expo Go にログインしている人だけ（自分専用） | 動かし続ける |

### 他の人に試してもらう（EAS Update）

試す人向けの手順と注意事項は `docs/testing/device-testing.md` にまとめてある。

1. 組織に招待する：expo.dev → 組織 `digital-iron-beads-team` → Members → Invite。**ユーザー名で招待**すると確実。役割は Developer（Viewer で開けるかは未確認）
2. 招待された人は、**シークレットウインドウで自分のアカウントにログインしてから**招待を承認する（持ち主がログイン中のブラウザで開くと、持ち主として処理されてメンバーにならない）
3. PC で配信する

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "説明"
```

4. 表示された URL（expo.dev の更新ページ）の「Preview」の QR コードを、自分のアカウントで Expo Go にログインした iPhone で読む。開けないときは Expo Go でログインし直す

### 自分で試す（開発サーバー。Raspberry Pi などで動かしておく）

```bash
npx expo login
```

```bash
npx expo start --tunnel
```

tmux の中で動かすと、SSH を閉じても止まらない（抜けるときは Ctrl+B → D）。Expo Go は Expo CLI と同じアカウントでログインしておく。

Expo Go では、AirDrop や「ファイル」アプリから .beads を開く機能とアプリのアイコンは試せない（TestFlight で確認する）。マイルストーンごとの確認項目は `docs/checklists/` にある。

## ビルド・提出（EAS）

EAS Build / Submit には Expo アカウントが必要です（`npx eas-cli@latest login`）。
App Store 提出には Apple Developer Program への登録が必要です。

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```
