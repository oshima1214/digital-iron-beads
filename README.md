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

## はじめての人へ：リポジトリから実機で試すまで

GitHub のこのリポジトリしか知らない人が、自分の iPhone・iPad でアプリを試せるようになるまでの流れ。上から順に進める。

組織への招待を待たずに試したいときは、下の「招待なしで試す」へ。

### 0. 用意するもの

| もの | 用途 |
|---|---|
| iPhone または iPad | 試す端末。App Store から **Expo Go**（無料）を入れる |
| Expo のアカウント（無料） | [expo.dev](https://expo.dev) で作る。**ユーザー名**を控えておく |
| パソコン（Windows / Mac） | 自分で新しい版を配信するときだけ必要。試すだけなら不要 |

### 1. 試すための許可をもらう（全員。配信する人も）

このアプリは Expo の組織 `digital-iron-beads-team` のプロジェクトなので、配信を**開く**のも、新しい版を**配信する**のも、その組織のメンバーだけができる。配信する人は役割が **Developer 以上**であること（Viewer では配信できない）。

1. 持ち主（リポジトリのオーナー）に、Expo の**ユーザー名**を伝えて招待してもらう
2. 招待メールが届いたら、ブラウザの**シークレット（プライベート）ウインドウ**で expo.dev に**自分のアカウントで**ログインし、そのウインドウで招待のリンクを開いて承認する
   - ほかの人がログインしたままのブラウザで開くと、その人として処理されて自分はメンバーにならない
3. iPhone / iPad の Expo Go を開き、同じアカウントでログインする

### 2-A. 試すだけの人

持ち主や配信する人から送られてくる QR コード（expo.dev の更新ページの「Preview」）を、iPhone / iPad のカメラで読んで「Expo Go で開く」。
新しい版が出たら、Expo Go を**完全に終了してから**開き直す（変わらなければもう一度）。
詳しい手順・報告のしかた・注意事項は [docs/testing/device-testing.md](docs/testing/device-testing.md)。

### 2-B. 自分で配信もする人（パソコンの準備）

1. パソコンに入れる
   - [Git](https://git-scm.com/downloads)
   - [Node.js](https://nodejs.org/) の **22**（CI と同じ版。LTS の 22.x を選ぶ）
2. リポジトリを取ってくる（PowerShell / ターミナルで1行ずつ）

```bash
git clone https://github.com/oshima1214/digital-iron-beads.git
```

```bash
cd digital-iron-beads
```

```bash
npm ci
```

   - 「vulnerabilities」の警告が出ても気にしない。**`npm audit fix --force` は実行しない**（Expo の部品の版が変わって動かなくなる）

3. Expo にログインする（1. で招待を承認したアカウント。組織のメンバーでないと、4. で権限のエラーになる）

```bash
npx eas-cli@latest login
```

4. 配信する（`--message` には何を変えたかを書く）

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "変更の説明"
```

5. 表示された URL を開き、「Preview」の QR コードを iPhone / iPad のカメラで読む。試す人にもこの QR コードを送る

### 3. 2回目からの配信

リポジトリのフォルダで、最新にしてから配信する。

```bash
git pull
```

```bash
npm ci
```

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "変更の説明"
```

配信できたかは次で確かめられる（一番上に今の説明が出ていれば成功）。

```bash
npx eas-cli@latest update:list --branch preview
```

### 4. 何を確かめるか

実機確認リストは [docs/checklists/](docs/checklists/) にある。結果の欄に OK や気づいたことを書く。

### うまくいかないとき

| 症状 | 対処 |
|---|---|
| Expo Go で「There was a problem loading the project」や 403 | Expo Go にログインしていない、または招待を承認していない。1. をやり直す |
| 「We couldn't find this invitation」 | 招待が無効になっている。持ち主に**ユーザー名で**招待し直してもらう |
| 開けるが古いまま | Expo Go を完全に終了して開き直す。配信したかは `update:list` で確かめる |
| `cd digital-iron-beads` で「パスが存在しない」 | `git clone` をしたフォルダにいない。clone した場所で実行するか、2-B の 2. からやり直す |
| 配信（`eas update`）で権限のエラー（403 / not authorized など） | ログインしているアカウントが組織のメンバーでない、または役割が Viewer。持ち主に招待・役割の変更（Developer）を頼む。`npx eas-cli@latest whoami` でログイン中のアカウントを確かめる |
| `git pull` で「not a git repository」 | リポジトリのフォルダの中で実行していない。`cd digital-iron-beads` してから |
| Expo Go が「SDK に対応していない」 | Expo Go の更新で、このアプリの版（Expo SDK 58）に対応しなくなった。持ち主に知らせる |

Expo Go では、アプリのアイコンと、AirDrop や「ファイル」アプリから `.beads` を開く機能は試せない（TestFlight で確認する）。

## 招待なしで試す（リポジトリだけで）

組織 `digital-iron-beads-team` に入らなくても、次のどちらかで試せる。パソコンの準備（Git・Node.js 22・`git clone`・`npm ci`）は上の「2-B」の 1.〜2. と同じ。

### 方法1：パソコンと同じ Wi-Fi で、開発サーバーにつなぐ（アカウント不要）

1. パソコンと iPhone / iPad を**同じ Wi-Fi** につなぐ
2. リポジトリのフォルダで開発サーバーを動かす

```bash
npx expo start
```

3. 表示された QR コードを、iPhone / iPad のカメラで読んで「Expo Go で開く」
   - Expo Go でログインを聞かれたら「Proceed anonymously（ログインせずに進む）」を選ぶ
   - Windows で「ファイアウォールでブロックされています」と出たら、**プライベート ネットワーク**で許可する
4. 終わったら、パソコンの画面で `Ctrl + C` を押して止める

- パソコンで動かしている間だけ、同じ Wi-Fi の端末から使える
- 学校や会社の Wi-Fi など、端末どうしの通信を止めているネットワークではつながらない。そのときは方法2 を使う
- 開発サーバーがログインを求めて進まないときは `npx expo start --offline` で動かす（同じ Wi-Fi でつなぐだけなら、ログインは要らない）

### 方法2：自分の Expo アカウントに配信する（どこからでも開ける）

本来の配信先（組織のプロジェクト）とは別に、自分のアカウントにこのアプリのプロジェクトを作って配信する。`app.json` は書き換えず、環境変数で配信先を切り替える（`app.config.ts`）。

1. [expo.dev](https://expo.dev) で自分のアカウントを作り、パソコンでログインする

```bash
npx eas-cli@latest login
```

2. 配信先を自分のアカウントにする（`自分のユーザー名` を書き換える。PowerShell を閉じると消えるので、開き直したらもう一度）

```powershell
$env:EXPO_OWNER = "自分のユーザー名"
```

   Mac のターミナルでは：

```bash
export EXPO_OWNER="自分のユーザー名"
```

3. 自分のアカウントにプロジェクトを作る（最初の1回だけ）

```bash
npx eas-cli@latest init --account 自分のユーザー名
```

   - 表示されたプロジェクトの ID（`xxxxxxxx-xxxx-…` の形）を控える。設定ファイルに書くよう言われても、**ファイルは書き換えない**（次の 4. で環境変数にする）
   - expo.dev の画面で、名前（slug）を `digital-iron-beads` にしてプロジェクトを作り、その ID を使ってもよい

4. プロジェクトの ID を設定する

```powershell
$env:EXPO_PROJECT_ID = "控えたプロジェクトの ID"
```

   Mac のターミナルでは：

```bash
export EXPO_PROJECT_ID="控えたプロジェクトの ID"
```

5. 配信する

```bash
npx eas-cli@latest update --branch preview --platform ios --message "変更の説明"
```

6. 表示された URL の「Preview」の QR コードを、**同じアカウントでログインした** Expo Go で読む

- 2回目からは、2. と 4. の環境変数を設定してから 5. をする
- 環境変数を設定していないと、本来の配信先（組織のプロジェクト）に配信しようとする（組織のメンバーでなければ権限のエラーで止まる）
- この方法で配信した版は、自分のアカウント（と、自分が招待した人）だけが開ける

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
