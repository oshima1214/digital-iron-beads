# M2 ホーム・保存・作成フロー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ホーム（作品一覧）、作品の保存と自動保存、写真の取り込み → 切り抜き・明るさ調整 → ビーズ化設定までの画面を作り、「写真からシートを作り、アプリを再起動しても再開できる」状態にする（仕様書 §10 M2）。

**Architecture:** 画面は `src/app/`（expo-router）。状態は zustand（`src/state/`）。保存は `ProjectRepo` インターフェースの裏で、iOS は expo-file-system、Web（自動テスト用）は localStorage に分ける（`.web.ts` で切り替え）。画像のピクセルは iOS が ImageManipulator＋Skia、Web が canvas で読む。シートの描画は Skia（Web は CanvasKit）。データの検証・自動保存のタイミング・画像の前処理は `src/core` に純粋関数として置き、Jest でテストする。

**Tech Stack:** Expo SDK 58、expo-router、expo-file-system（`File`/`Directory`/`Paths`）、expo-image-picker（`launchImageLibraryAsync`）、expo-image-manipulator（`ImageManipulator.manipulate`）、@shopify/react-native-skia 2.14、@react-native-community/slider、zustand 5、Playwright（Web 版の E2E）

**Spec:** `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md`

## Global Constraints

- 前回の計画（M0+M1）の Global Constraints はすべて引き続き有効
- 画面ファイルは `src/app/` に置く。画面以外のコードは `src/ui/`、`src/state/`、`src/platform/`、`src/core/` に置く
- Expo のパッケージは `EXPO_OFFLINE=1 npx expo install` で入れる（この環境では Expo の API サーバーに接続できないため）
- **どの画面もスクロールしない**（ScrollView を使わない）。iPhone 390×844 と iPad 820×1180 の Web 表示で、`document.scrollingElement.scrollHeight <= innerHeight` を E2E で確認する
- 色やフォントは `src/ui/theme.ts` の `colors` と `fonts` だけを使う。ボタンの大きさは 44pt 以上
- 表記は漢字の標準表記。ボタンの文言はこの計画に書いたとおりにする
- 外部への通信はしない（画像は端末の中だけで扱う）

## Review Focus

1. **巨大な写真（例: 6000×4000 の HEIC/JPEG）** → 取り込むときに長い辺 2048px へ縮小され、メモリ不足で落ちない（Task 5 の Web 実装テストと、Task 13 の実機確認リスト）
2. **変換の途中にアプリが終了する・バックグラウンドに移る** → 最後の設定が保存されていて、再開すると ③ の画面に戻る（Task 3 `flush on background` と Task 12 の E2E「再読み込みで再開」）
3. **project.json が壊れている、または未来のバージョン** → その作品だけ一覧から除き、ほかの作品は表示する（Task 2 `parseProject rejects` と Task 4 `list skips corrupt entries`）
4. **写真へのアクセスを拒否された、または選択をキャンセルした** → エラーにならず ① の画面のまま。拒否のときは案内を出す（Task 9）
5. **切り抜き枠を画像の外まで、または極小（1px）までドラッグする** → 枠は画像の中に収まり、最小 8px×8px を保つ（Task 1 `clampCrop`）

---

### Task 1: 画像の前処理（切り抜き・明るさ・コントラスト・縮小）

**Files:**
- Create: `src/core/image/adjust.ts`
- Test: `src/core/image/adjust.test.ts`
- Modify: `src/core/index.ts`（export を追加）

**Interfaces:**
- Consumes: `RgbaImage`（`src/core/convert/types.ts`）
- Produces:
  - `interface CropRect { x: number; y: number; w: number; h: number }`（元画像のピクセル座標）
  - `clampCrop(rect: CropRect, imgW: number, imgH: number, minSize = 8): CropRect`
  - `cropImage(img: RgbaImage, rect: CropRect): RgbaImage`
  - `adjustImage(img: RgbaImage, brightness: number, contrast: number): RgbaImage`（どちらも -100..100。0,0 なら同じ内容のコピー。アルファは変えない）
  - `resizeMax(img: RgbaImage, maxSide: number): RgbaImage`（長い辺が maxSide 以下ならそのまま返す。大きければ面積平均で縮小する）

- [ ] **Step 1: テストを書く**

```ts
test('clampCrop keeps rect inside image and at least 8px', () => {
  expect(clampCrop({ x: -10, y: 5, w: 50, h: 2 }, 40, 40)).toEqual({ x: 0, y: 5, w: 40, h: 8 });
  expect(clampCrop({ x: 39, y: 39, w: 20, h: 20 }, 40, 40)).toEqual({ x: 32, y: 32, w: 8, h: 8 });
});
test('cropImage copies the sub-rectangle', () => { /* 4x4 の左上だけ赤 → {x:0,y:0,w:2,h:2} の全ピクセルが赤 */ });
test('adjustImage 0/0 is identity, brightness +100 makes white, contrast -100 makes mid gray', () => {
  // (100,50,200) に +100 の明るさ → (255,255,255)。contrast -100 → (128,128,128)。アルファは保持
});
test('resizeMax downsizes long side and keeps aspect', () => {
  const r = resizeMax(solid(4000, 1000, [1, 2, 3, 255]), 2048); expect([r.width, r.height]).toEqual([2048, 512]);
  expect(resizeMax(solid(100, 50, [0, 0, 0, 255]), 2048).width).toBe(100);
});
```

- [ ] **Step 2: テストが失敗することを確認する**（`npx jest src/core/image`、Expected: FAIL）
- [ ] **Step 3: 実装する**

明るさは `v + brightness/100*255`、コントラストは `(v-128)*f+128`（`f = (100+contrast)/100`）で計算し、0..255 に収める。`resizeMax` は `tools/compare/legacy.ts` の `resizeArea` と同じ面積平均の処理を `src/core/image/adjust.ts` に移し、legacy 側はそれを import する

- [ ] **Step 4: テストが通ることを確認する** → **Step 5: Commit**（`feat(core): add crop/adjust/resize image ops`）

### Task 2: 作品データ（Project）の型と検証

**Files:**
- Create: `src/core/file/project.ts`
- Test: `src/core/file/project.test.ts`

**Interfaces:**
- Consumes: `Sheet`、`SheetSize`、`createSheet`、`ConvertSettings`、`CropRect`（Task 1）
- Produces:
  - 仕様書 §4 の `Project` に、`stage: 'setup' | 'edit'` を追加する（setup = ③ のビーズ化設定の途中。再開するときの行き先を決める）。`source` は `{ image: string; crop?: CropRect; brightness: number; contrast: number; convert: ConvertSettings }`（`image` は作品フォルダ内のファイル名。例 `"source.png"`）
  - `newProjectId(): string`（`Date.now().toString(36)` とランダムな6文字を連結）
  - `createProject(name: string, sheet: Sheet, now: Date): Project`
  - `serializeProject(p: Project): string`（JSON。cells は base64）
  - `class ProjectParseError extends Error`
  - `parseProject(json: string): Project`（formatVersion が 1 以外、サイズが 13/21/29/58/116 以外、cells の長さが合わない、値が 0..32 の外のときは `ProjectParseError`）
  - `interface ProjectSummary { id: string; name: string; updatedAt: string; stage: Project['stage']; sheet: Sheet }`

- [ ] **Step 1: テストを書く**

```ts
test('serialize → parse roundtrip keeps cells and source', () => { /* 29x29 に値を入れて往復し、toEqual で一致 */ });
test('parseProject rejects future formatVersion', () => { expect(() => parseProject(json({ formatVersion: 2 }))).toThrow(ProjectParseError); });
test('parseProject rejects wrong cells length and out-of-range values', () => {});
test('parseProject rejects broken JSON', () => { expect(() => parseProject('{')).toThrow(ProjectParseError); });
test('newProjectId is unique across calls', () => { expect(new Set(Array.from({ length: 100 }, newProjectId)).size).toBe(100); });
```

- [ ] **Step 2〜4: テストの失敗を確認 → 実装 → テストの成功を確認**（base64 は `Buffer` に頼らず、自前の小さなエンコーダとデコーダを書く。Hermes には Buffer がないため）
- [ ] **Step 5: Commit**（`feat(core): add project model with validation`）

### Task 3: 自動保存のタイミング制御

**Files:**
- Create: `src/core/util/autosave.ts`
- Test: `src/core/util/autosave.test.ts`

**Interfaces:**
- Produces: `createAutosaver<T>(save: (v: T) => Promise<void>, delayMs = 500): { schedule(v: T): void; flush(): Promise<void>; readonly pending: boolean; readonly lastError: unknown }`

- [ ] **Step 1: テストを書く**（`jest.useFakeTimers()` を使う）

```ts
test('debounces: only the last value within 500ms is saved', async () => {});
test('flush on background saves immediately and clears the timer', async () => {});
test('failed save keeps the value pending and retries on next schedule/flush', async () => {});
test('flush with nothing pending does not call save', async () => {});
```

- [ ] **Step 2〜4** → **Step 5: Commit**（`feat(core): add debounced autosaver`）

### Task 4: 作品の保存先（ProjectRepo）

**Files:**
- Create: `src/platform/projectRepo.types.ts`、`src/platform/projectRepo.ts`（iOS: expo-file-system）、`src/platform/projectRepo.web.ts`（localStorage）、`src/platform/memoryRepo.ts`（テスト用）
- Test: `src/platform/memoryRepo.test.ts`（リポジトリの共通の振る舞いをテストする）
- Modify: `jest.config.js`（core プロジェクトの testMatch に `src/platform/**/*.test.ts` と `src/state/**/*.test.ts` を追加）

**Interfaces:**
- Consumes: Task 2 の `Project`、`ProjectSummary`、`serializeProject`、`parseProject`
- Produces:
  ```ts
  interface ProjectRepo {
    list(): Promise<ProjectSummary[]>;          // updatedAt の新しい順。壊れた作品は除き、console.warn で知らせる
    load(id: string): Promise<Project>;
    save(p: Project): Promise<void>;
    remove(id: string): Promise<void>;
    saveSource(id: string, png: Uint8Array): Promise<string>;  // ファイル名を返す（"source.png"）
    sourceUri(id: string, name: string): string;              // 画像として表示・読み込みに使う URI
  }
  export const projectRepo: ProjectRepo;  // projectRepo.ts / projectRepo.web.ts がそれぞれ export する
  export function createMemoryRepo(): ProjectRepo & { corrupt(id: string): void };
  ```
- iOS の保存場所：`Paths.document/projects/<id>/project.json` と `source.png`。書き込みは `project.json.tmp` に書いてから `move` する（書き込み中に落ちても壊れないようにするため）

- [ ] **Step 1: テストを書く**（メモリ版で：save → list → load の往復、updatedAt の順、`list skips corrupt entries`、remove すると list と load から消える）
- [ ] **Step 2〜4** → **Step 5: Commit**（`feat(platform): add project repository (file system, web, memory)`）

### Task 5: 画像ピクセルの読み込み

**Files:**
- Create: `src/platform/pixels.ts`（iOS）、`src/platform/pixels.web.ts`

**Interfaces:**
- Consumes: Task 1 の `resizeMax`
- Produces:
  - `loadRgba(uri: string, maxSide = 2048): Promise<RgbaImage>`
  - `encodePng(img: RgbaImage): Promise<Uint8Array>`（source.png の保存用）
- iOS の手順：
  1. `ImageManipulator.manipulate(uri).resize(長い辺 maxSide).renderAsync()` → `saveAsync({ format: SaveFormat.PNG, base64: true })`
  2. `Skia.Data.fromBase64` → `Skia.Image.MakeImageFromEncoded` → `readPixels(0, 0, { width, height, colorType: RGBA_8888, alphaType: Unpremul })`
- `encodePng`：iOS は `Skia.Image.MakeImage(...).encodeToBytes()`。Web は canvas の `toBlob`

- [ ] **Step 1: 実装する**（端末に依存するため単体テストはしない。Task 12 の E2E で Web 版を確認し、iOS 版は Task 13 の実機確認リストに入れる）
- [ ] **Step 2: `npx tsc --noEmit` と `npx expo lint` が通ることを確認する**
- [ ] **Step 3: Commit**（`feat(platform): add pixel loading via Skia (iOS) and canvas (web)`）

### Task 6: シートの描画（Skia）と Web の準備

**Files:**
- Create: `src/ui/sheetGeometry.ts`、`src/ui/SheetCanvas.tsx`、`src/ui/SheetThumb.tsx`、`src/app/_layout.web.tsx`（Skia Web の読み込み）、`public/canvaskit.wasm`（`npx setup-skia-web public` で生成）
- Test: `src/ui/sheetGeometry.test.ts`
- Modify: `jest.config.js`（core プロジェクトの testMatch に `src/ui/**/*.test.ts` を追加）

**Interfaces:**
- Consumes: `Sheet`、`beadByIndex`、`PLATE`、`colors`
- Produces:
  - `sheetLayout(sheet: Sheet, boxW: number, boxH: number): { cell: number; width: number; height: number }`（正方形のマスで、箱に収まる最大の大きさ）
  - `<SheetCanvas sheet={Sheet} width={number} height={number} />`
    - ビーズは直径がマスの 0.98 の丸
    - 白いビーズ（5001）は `#C7C7CC` の 1px の縁
    - 背景は直径がマスの 0.14 の `#C7C7CC` の点
    - グリッドの線は `#E5E5EA` の 0.5px、29マスごとのプレートの境界は `#AEAEB2` の 1.5px
  - `<SheetThumb sheet={Sheet} size={number} />`（1マスを1ピクセルとして描き、最近傍で拡大する。軽量）
- Web：`_layout.web.tsx` で `LoadSkiaWeb({ locateFile: (f) => '/' + f })` が終わるまで何も描かない。そのあとは `_layout.tsx` と同じ Stack にする（共通部分は `src/ui/RootStack.tsx` に切り出す）

- [ ] **Step 1: テストを書く**（`sheetLayout`：29 マスを 300×400 の箱に → cell 10、width 290。116 マスを 300×300 に → cell 2.586…）
- [ ] **Step 2〜4** → `npm run web:export` で wasm が `dist/` に含まれることも確認する
- [ ] **Step 5: Commit**（`feat(ui): add Skia sheet canvas, thumbnail and web CanvasKit loading`）

### Task 7: 状態管理（作品一覧と作成中の下書き）

**Files:**
- Create: `src/state/projects.ts`、`src/state/draft.ts`
- Test: `src/state/projects.test.ts`、`src/state/draft.test.ts`

**Interfaces:**
- Consumes: Task 2〜4
- Produces:
  - `createProjectsStore(repo: ProjectRepo)` → zustand の vanilla ストア。状態は `{ items: ProjectSummary[]; loading: boolean }`。操作は `refresh()`、`rename(id, name)`、`duplicate(id)`（名前は「◯◯ のコピー」）、`remove(id)`
  - `useProjects`（`projectRepo` に結びつけたフック）
  - `createDraftStore(repo: ProjectRepo, autosaveMs = 500)` → `{ project: Project | null; image: RgbaImage | null; preview: Sheet | null; busy: boolean }`
    - `startFromImage(img: RgbaImage, name: string): Promise<string>`：作品を作り、source.png を保存し、`stage: 'setup'` で保存して id を返す
    - `open(id)`：source を読み込み直す
    - `setCrop`、`setAdjust(brightness, contrast)`、`setSettings(partial)`：変更のたびに自動保存の予約をする
    - `convertPreview(quality: 'fast' | 'full')`：fast は cellPx 2、full は 8
    - `finish(): Promise<string>`：full で変換してシートを保存し、`stage: 'edit'` にする
    - `flush()`
  - `useDraft`
- 作品の名前の初期値は「作品 N」（N = 既存の作品の数 + 1）

- [ ] **Step 1: テストを書く**（メモリ版のリポジトリと fake timers を使う）
  - `startFromImage → setSettings → 500ms 後に repo に settings が保存されている`
  - `finish で stage が edit になり、シートの大きさが settings.size`
  - `duplicate で新しい id、名前に「のコピー」`
  - `rename と remove が一覧に反映される`
- [ ] **Step 2〜4** → **Step 5: Commit**（`feat(state): add projects and draft stores with autosave`）

### Task 8: ホーム画面

**Files:**
- Modify: `src/app/index.tsx`
- Create: `src/ui/ProjectCard.tsx`、`src/ui/Button.tsx`（主ボタンと副ボタン、高さ 44 以上）

**Interfaces:**
- Consumes: `useProjects`、`SheetThumb`
- 画面の内容
  - 見出し「作品」
  - 2列のカード（サムネイル・名前・`M/D` の日付）。カードを長押しすると、iOS は `ActionSheetIOS`、Web は簡易メニューで「名前を変更」「複製」「削除」を出す。削除は確認ダイアログを出す
  - 作品が0件なら「まだ作品がありません」
  - 下部に固定で「＋ 新しく作る」（主ボタン）
  - カードをタップしたら、stage が setup なら `/new/convert?id=`、edit なら `/project/[id]` へ移る
  - 画面に入るたびに `refresh()` する（`useFocusEffect`）
- 作品が多いときは、カードの一覧部分だけを `FlatList` でスクロールさせる。「スクロールしない」の対象は画面全体で、一覧の中のスクロールは例外とする

- [ ] **Step 1: 実装する** → **Step 2: typecheck・lint と、Web で表示を確認する** → **Step 3: Commit**（`feat(app): home screen with project grid`）

### Task 9: ① 素材選び

**Files:**
- Create: `src/app/new/index.tsx`
- Modify: `app.json`（expo-image-picker のプラグインに `photosPermission: "ビーズの図案にする写真を選ぶために、写真ライブラリを使います。"` を設定）

- 「写真から作る」「文字から作る」「白紙から作る」の3つの大きなボタン
  - 「文字から作る」は M5 まで無効にして、「準備中」と表示する
- **写真**：`launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 })`
  - キャンセルなら何もしない
  - 失敗や拒否のときは「写真を読み込めませんでした。設定アプリで写真へのアクセスを許可してください。」と表示する
  - 成功したら `loadRgba` → `startFromImage` → `/new/prepare?id=`
- **白紙**：サイズを選ぶシート（13/21/29/58/116）→ 空のシートの作品を `stage: 'edit'` で保存 → `/project/[id]`

- [ ] **Step 1: 実装する** → **Step 2: typecheck・lint** → **Step 3: Commit**（`feat(app): source selection screen`）

### Task 10: ② 下ごしらえ

**Files:**
- Create: `src/app/new/prepare.tsx`、`src/ui/CropBox.tsx`、`src/ui/LabeledSlider.tsx`

- 上部：画像（Skia の Image、または expo の Image で縦横比を保って表示）と切り抜き枠
  - 枠は4隅のハンドルで大きさを変え、中をドラッグで移動する（gesture-handler の Pan）
  - 座標は元画像のピクセルに変換し、`clampCrop` で収める
- 下部：「明るさ」「コントラスト」のスライダー（-100..100、刻み 1、中央が 0）と「元に戻す」
  - 表示用の画像には `adjustImage` を縮小版（長い辺 512px）にかけて反映する
- ナビゲーションバー：「‹ 戻る」と「次へ」（→ `/new/convert?id=`）
- 値はすべて draft に入れて、自動保存する

- [ ] **Step 1: 実装する** → **Step 2: typecheck・lint・Web で確認** → **Step 3: Commit**（`feat(app): crop and brightness/contrast screen`）

### Task 11: ③ ビーズ化の設定

**Files:**
- Create: `src/app/new/convert.tsx`、`src/ui/Segmented.tsx`、`src/ui/BeadPicker.tsx`（使うビーズを選ぶシート）、`src/ui/SettingRow.tsx`

- 上部：`SheetCanvas`（preview）と「使用 N色 ・ M粒」
- 下部の設定（スクロールしない。足りない項目はシートを開いて出す）
  - **サイズ**：13 / 21 / 29 / 58 / 116
  - **用途**：イラスト / 写真 / 2色
  - **使うビーズ** ›：シートを開いて「基本16色」「全32色」「手持ちを選ぶ」を選ぶ。手持ちを選ぶ場合は、32色のチップを複数選択する（最低1色）
  - **色数の上限**：スライダー 2..32
  - **ノイズ掃除**：なし / 弱 / 強
  - **背景を自動で除く**：スイッチ
  - 用途が「写真」のときは「ディザリング」スイッチを出す
  - 用途が「2色」のときは「暗い色」「明るい色」「しきい値」を出す（このとき色数の上限は隠す）
- 変換のタイミング
  - スライダーを動かしている間は `convertPreview('fast')`
  - 指を離したときと、ほかの設定を変えたときは `convertPreview('full')`
  - 変換は `setTimeout(0)` のあとに実行し、その間は小さなインジケーターを出す
- ナビゲーションバー：「‹ 戻る」と「完了」（`finish()` → `router.replace('/project/[id]')`）

- [ ] **Step 1: 実装する** → **Step 2: typecheck・lint・Web で確認** → **Step 3: Commit**（`feat(app): conversion settings screen with live preview`）

### Task 12: 作品画面（M3 までの仮の画面）と Web の E2E

**Files:**
- Create: `src/app/project/[id].tsx`、`e2e/m2-flow.mjs`、`e2e/fixtures/face.png`（`tools/compare/fixtures/face.png` のコピー）
- Modify: `package.json`（scripts に `"e2e:web": "npm run web:export && node e2e/m2-flow.mjs"` を追加）

- 作品画面：作品名、`SheetCanvas`、品番ごとの必要数（上位8件と「ほか N色」）、「ホームへ」。編集の機能は M3 で作る
- E2E（Playwright、`serve dist` を立ち上げる）
  1. iPhone サイズで空のホームを表示する
  2. 「＋ 新しく作る」→「写真から作る」で、file chooser に face.png を渡す
  3. ② で「次へ」
  4. ③ で preview が描画されたら、サイズ「13」を選ぶ
  5. 「完了」→ 作品画面に「必要なビーズ」と表示される
  6. 再読み込みしてホームに戻る → カードが1枚ある
  7. もう1つ作品を作り、③ の途中で再読み込みする → ホームのカードをタップすると ③ に戻る（**再開**）
  8. 各画面で、iPhone 390×844 と iPad 820×1180 のどちらでも、`scrollHeight <= innerHeight` であることを確認する

- [ ] **Step 1: 実装する** → **Step 2: `npm run e2e:web` を実行**（Expected: すべてのチェックが PASS と表示される）→ **Step 3: Commit**（`feat(app): project view placeholder and web E2E for M2 flow`）

### Task 13: 実機確認リストと README

**Files:**
- Create: `docs/checklists/m2-device.md`
- Modify: `README.md`

- 実機での確認項目
  1. 写真を選んで ② と ③ が表示される
  2. 巨大な写真（4800 万画素）でも落ちない
  3. 116 マスの変換時間（目標: 2秒以内）を記録する
  4. アプリを強制終了してから再開すると、続きから始まる
  5. 写真へのアクセスを拒否したときに案内が出る
  6. iPhone と iPad で、どの画面もスクロールしない
- 開発用ビルドの作り方（`npx eas-cli@latest build --profile development --platform ios`）を README に書く

- [ ] **Step 1: 書く** → **Step 2: Commit**（`docs: M2 device checklist`）

---

## 仕様書との違い（この計画で決めたこと）

- `Project` に `stage: 'setup' | 'edit'` を追加する。③ の途中でも自動保存して再開できるようにするため（仕様書 §3.3「一時保存」を実現する方法として）
- `thumb.png` は保存しない。ホームのサムネイルは、シートのデータから毎回描く（Skia で1マスを1ピクセルとして描くので軽い）
- 元画像は、仕様書の `source.jpg` ではなく `source.png` で保存する（Skia の PNG エンコードを使い、Web と同じ処理にするため）
