# M0+M1 土台と中心の処理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo SDK 58 のアプリの土台（CI つき）を作り、React Native に依存しない `src/core` に、パレット・シート・編集操作・Undo/Redo・画像からビーズへの変換アルゴリズム（案1）・比較用のテスト環境を実装する。

**Architecture:** `src/core` は純粋な TypeScript で、Node 上の Jest でテストする。シートは `Uint8Array` のパレット番号配列で表す（0 = 背景）。編集操作は `CellChange[]` を返す純粋関数として作り、適用と Undo/Redo は `history` が受け持つ。変換は段ごとの関数（背景 → 線 → 代表色 → 色の絞り込み → ノイズ掃除）を `convertImage` がつなぐ。`tools/compare` は Node 上で、元のアルゴリズム（V7）と新しいアルゴリズムを並べた HTML を出力する。

**Tech Stack:** Expo SDK 58（expo 58.0.x）、expo-router、TypeScript strict、jest-expo、eslint-config-expo、GitHub Actions、EAS、tsx（tools 実行用）、pngjs（tools 用）、@expo-google-fonts/biz-udpgothic

**Spec:** `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md`（補足: `docs/research/2026-11-11-tech-notes.md`）

## Global Constraints

- TypeScript は `strict: true`。`any` は使わない
- `src/core/**` から `react`、`react-native`、`expo*`、`@shopify/*` を import してはいけない（ESLint の `no-restricted-imports` で強制する）
- 外部への通信、広告、分析の SDK を入れない
- パレットは `perler-32` のみ。Bead.index は 1..32、0 は背景
- シートのサイズは `13 | 21 | 29 | 58 | 116`。プレートは 29×29。58 は 2×2、116 は 4×4。13 と 21 はプレートの左上に置く
- 変換の作業用解像度は 1マス＝8×8ピクセル（`WORK_CELL_PX = 8`）
- 色の距離は OKLab のユークリッド距離。最近傍色は、sRGB を各チャンネル5ビット（32,768通り）に分けた対応表で引く
- Undo の上限は200手
- UI のフォントは BIZ UDPゴシック（400/700）
- 対応プラットフォームは `ios`。`web` は自動テスト用にのみビルドする（Android はビルド対象外）
- ブランチ: M0 は `feat/m0-scaffold`、M1 は `feat/m1-core`。それぞれ PR を出し、CI が通ったら squash でマージする
- コミットメッセージの末尾には、セッションで指定されたアトリビューション行を付ける

## Review Focus

1. **極端な縦横比の画像**（例: 3000×40 の横長の帯）→ 落ちずに、少なくとも1行のシートが作られる。0行にはしない（Task 8 のテスト `fitToWork: extreme aspect keeps at least 1 cell`）
2. **全面が透明、または全部が背景と判定される画像** → 空のシート（全マス0）、個数の集計は空の配列、例外を出さない（Task 10 のテスト `convertImage: fully transparent → empty sheet`）
3. **黒い背景に黒い輪郭のキャラ**（V7 では削られていた）→ `removeBackground=false` なら黒い部分も残る。`true` でも、外周から色が途切れずにつながっていない黒い輪郭は残る（Task 8 のテスト `backgroundMask: dark outline not connected to border survives`）
4. **縁取りで、オブジェクトがシートの端に接している、または内部に穴がある場合** → 範囲外アクセスをしない。内部の穴は塗らず、外周とつながった背景だけを塗る（Task 6 のテスト `outline: object touching edge` と `outline: interior hole untouched`）
5. **使うビーズが1色だけ、または `maxColors` が使えるビーズの数より大きい場合** → 1色だけならすべてその色になる。`maxColors` が大きい場合は何もしない（Task 10 のテスト `reduceColors: maxColors above used count is no-op` と `convertImage: single allowed bead`）

---

## M0: 土台（ブランチ `feat/m0-scaffold`）

### Task 1: Expo プロジェクトの作成と開発ツールの設定

**Files:**
- Create: `package.json`、`app.json`、`tsconfig.json`、`babel.config.js`（必要な場合のみ）、`eslint.config.js`、`jest.config.js`、`app/_layout.tsx`、`app/index.tsx`、`src/ui/theme.ts`、`src/core/index.ts`、`src/core/__tests__/smoke.test.ts`
- Modify: `.gitignore`、`README.md`

**Interfaces:**
- Produces: npm scripts の `typecheck`（`tsc --noEmit`）、`lint`（`eslint .`）、`test`（`jest`）、`web:export`（`expo export -p web`）。`src/ui/theme.ts` の `colors`（`bg: "#F2F2F7"`、`panel: "#FFFFFF"`、`separator: "#E5E5EA"`、`accent: "#007AFF"`、`text: "#111111"`、`subtext: "#6B6B70"`）と `fonts`（`regular: "BIZUDPGothic_400Regular"`、`bold: "BIZUDPGothic_700Bold"`）

- [ ] **Step 1: リポジトリのルートで Expo SDK 58 のプロジェクトを作る**

Run: `npx create-expo-app@latest tmp-app --template default@sdk-58 --no-install`。生成されたファイルをリポジトリのルートへ移す（`legacy/`、`docs/`、`README.md`、`.gitignore` は残し、`.gitignore` は内容を統合する）。サンプル画面やコンポーネントは削除し、`app/_layout.tsx` と `app/index.tsx` だけを残す。その後 `npm install` を実行する

- [ ] **Step 2: 依存パッケージを追加する**

Run: `npx expo install @expo-google-fonts/biz-udpgothic expo-font expo-splash-screen jest-expo jest @types/jest`

- [ ] **Step 3: `app.json` を設定する**

`name: "デジタル・アイロンビーズ"`、`slug: "digital-iron-beads"`、`platforms: ["ios", "web"]`、`ios.supportsTablet: true`、`ios.bundleIdentifier: "com.oshima1214.digitalironbeads"`（App Store へ初めて提出する前なら変更できる）、`orientation: "default"`、`userInterfaceStyle: "light"`

- [ ] **Step 4: `tsconfig.json` で `strict: true` とパスエイリアス `@/*` → `src/*` を設定する**

- [ ] **Step 5: ESLint を設定する**

`eslint-config-expo` の flat config をもとに、`src/core/**` に対して `no-restricted-imports` で `react`、`react-native`、`expo`、`expo-*`、`@shopify/*`、`@/ui/*`、`@/platform/*` を禁止する

- [ ] **Step 6: Jest を設定する**

`jest.config.js` に2つのプロジェクトを定義する。
- `core`：`testEnvironment: "node"`、`preset: "jest-expo"`、`testMatch: ["<rootDir>/src/core/**/*.test.ts", "<rootDir>/tools/**/*.test.ts"]`
- `app`：`preset: "jest-expo/ios"`、`testMatch: ["<rootDir>/app/**/*.test.tsx", "<rootDir>/src/ui/**/*.test.tsx"]`

- [ ] **Step 7: 確認用のテストを書く**

```ts
// src/core/__tests__/smoke.test.ts
import { CORE_VERSION } from "@/core";
test("core module loads", () => { expect(CORE_VERSION).toBe(1); });
```
`src/core/index.ts` に `export const CORE_VERSION = 1;` を書く

- [ ] **Step 8: ルートレイアウトでフォントを読み込み、ホームの仮画面を作る**

- `app/_layout.tsx`：`useFonts({ BIZUDPGothic_400Regular, BIZUDPGothic_700Bold })` でフォントを読み込み、読み込み中はスプラッシュ画面を表示したままにする。`<Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }} />` を返す
- `app/index.tsx`：見出し「作品」（bold）と、文言「まだ作品がありません」を表示する

- [ ] **Step 9: すべての確認コマンドを実行する**

Run: `npm run typecheck && npm run lint && npm test && npm run web:export`
Expected: すべて終了コード 0。`dist/` に Web 版が出力される（`dist/` は `.gitignore` に入れる）

- [ ] **Step 10: Web 版で「作品」が表示されることを確認する**

Run: `npx serve dist -l 8081 &` のあと、Playwright のワンショットスクリプトで `http://localhost:8081` を開き、`getByText("作品")` が見えることを確認する（スクリプトはスクラッチパッドに置き、コミットしない）
Expected: 要素が見つかる

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "chore: scaffold Expo SDK 58 app with TS strict, ESLint, Jest, BIZ UDPGothic"
```

### Task 2: CI と EAS の設定

**Files:**
- Create: `.github/workflows/ci.yml`、`eas.json`
- Modify: `README.md`（開発用コマンドを追記）

**Interfaces:**
- Consumes: Task 1 の npm scripts
- Produces: PR と main への push で動くジョブ `ci`（後続の PR は、このジョブが通ることがマージの条件になる）

- [ ] **Step 1: `.github/workflows/ci.yml` を書く**

`on: [pull_request, push(main)]`、`ubuntu-latest`、Node 22、`npm ci`、`npm run typecheck`、`npm run lint`、`npm test -- --ci`、`npm run web:export`

- [ ] **Step 2: `eas.json` を書く**

`cli.version: ">= 16.0.0"`、`build.development`（`developmentClient: true`、`distribution: "internal"`、`ios.simulator: false`）、`build.preview`（`distribution: "internal"`）、`build.production`（`autoIncrement: true`）、`submit.production: {}`

- [ ] **Step 3: README に、開発用コマンド（typecheck / lint / test / web:export / compare）と、EAS を使うには Expo アカウントが必要なことを書く**

- [ ] **Step 4: Commit し、push して PR を出す**

```bash
git add -A && git commit -m "ci: add GitHub Actions workflow and EAS config"
git push -u origin feat/m0-scaffold
```
REST API で PR を作る（`gh api repos/oshima1214/digital-iron-beads/pulls`）

- [ ] **Step 5: CI が通ることを確認して、squash でマージする**

Run: `gh api repos/oshima1214/digital-iron-beads/commits/<sha>/check-runs --jq '.check_runs[]|{name,conclusion}'`
Expected: `ci` が `success`。そのあと `gh api -X PUT repos/oshima1214/digital-iron-beads/pulls/<n>/merge -f merge_method=squash`

---

## M1: 中心の処理（ブランチ `feat/m1-core`。マージ後の main から切る）

### Task 3: パレットと OKLab

**Files:**
- Create: `src/core/color/oklab.ts`、`src/core/palette/types.ts`、`src/core/palette/perler32.ts`
- Test: `src/core/color/oklab.test.ts`、`src/core/palette/perler32.test.ts`

**Interfaces:**
- Produces:
  - `type Rgb = readonly [number, number, number]`、`type Oklab = readonly [number, number, number]`
  - `srgbToOklab(r: number, g: number, b: number): Oklab`、`oklabDist2(a: Oklab, b: Oklab): number`（距離の2乗）
  - `interface Bead { index: number; code: string; name: string; rgb: Rgb; group: "basic" | "extended" }`
  - `type PaletteId = "perler-32"`、`PERLER32: readonly Bead[]`（32個、index の昇順）、`beadByIndex(i: number): Bead`
  - `BASIC16: readonly number[]`（basic グループの index 一覧）、`ALL32: readonly number[]`

- [ ] **Step 1: テストを書く**

```ts
test("srgbToOklab red", () => {
  const [L, a, b] = srgbToOklab(255, 0, 0);
  expect(L).toBeCloseTo(0.627955, 4); expect(a).toBeCloseTo(0.224863, 4); expect(b).toBeCloseTo(0.125846, 4);
});
test("srgbToOklab white/black", () => {
  expect(srgbToOklab(255,255,255)[0]).toBeCloseTo(1, 3); expect(srgbToOklab(0,0,0)[0]).toBeCloseTo(0, 6);
});
test("PERLER32 has indices 1..32 unique and codes unique", () => {
  expect(PERLER32.map(b => b.index)).toEqual(Array.from({length:32},(_, i)=>i+1));
  expect(new Set(PERLER32.map(b => b.code)).size).toBe(32);
});
test("white bead is 5001 (255,255,255) and basic", () => {
  const w = PERLER32.find(b => b.code === "5001")!; expect(w.rgb).toEqual([255,255,255]); expect(w.group).toBe("basic");
});
test("BASIC16 has 16 entries", () => { expect(BASIC16).toHaveLength(16); });
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx jest src/core/color src/core/palette`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装する**

- `oklab.ts`：sRGB をリニアに変換したあと、Björn Ottosson の行列で OKLab に変換する
- `perler32.ts`：`legacy/DigitalIronBeadsV7_colab.py` の `perler_basic_16`（group: basic）と `perler_extended_16`（group: extended）を、品番と名前に分けて、**元のコードの並び順**で index 1..32 を振る（basic の16色が 1..16、extended の16色が 17..32）

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx jest src/core/color src/core/palette`
Expected: PASS

- [ ] **Step 5: Commit**（`feat(core): add OKLab conversion and Perler 32 palette`）

### Task 4: 最近傍色の対応表

**Files:**
- Create: `src/core/palette/nearest.ts`
- Test: `src/core/palette/nearest.test.ts`

**Interfaces:**
- Consumes: Task 3 の `PERLER32`、`srgbToOklab`、`oklabDist2`
- Produces: `type NearestLut = Uint8Array`（長さ 32768）、`buildNearestLut(allowed: readonly number[]): NearestLut`（キャッシュつき。キーは allowed を昇順にして join した文字列）、`nearestIndex(lut: NearestLut, r: number, g: number, b: number): number`、`nearestToOklab(allowed: readonly number[], c: Oklab): number`（対応表を使わない、正確な計算）

- [ ] **Step 1: テストを書く**

```ts
test("every bead maps to itself with ALL32", () => {
  const lut = buildNearestLut(ALL32);
  for (const b of PERLER32) expect(nearestIndex(lut, ...b.rgb)).toBe(b.index);
});
test("restricted set only returns allowed", () => {
  const allowed = [beadIdx("5001"), beadIdx("5018")]; const lut = buildNearestLut(allowed);
  expect(nearestIndex(lut, 200, 0, 0)).toBe(beadIdx("5018")); // 濃い赤は黒に近い
  expect(nearestIndex(lut, 250, 250, 240)).toBe(beadIdx("5001"));
});
test("single allowed bead maps everything to it", () => {
  const lut = buildNearestLut([7]); expect(new Set(lut)).toEqual(new Set([7]));
});
test("lut is cached by allowed set", () => { expect(buildNearestLut([2,1])).toBe(buildNearestLut([1,2])); });
```
（`beadIdx(code)` はテスト内のヘルパー）

- [ ] **Step 2: テストが失敗することを確認する**（Run: `npx jest src/core/palette/nearest`、Expected: FAIL）

- [ ] **Step 3: 実装する**

`key = (r>>3)<<10 | (g>>3)<<5 | (b>>3)`。各ビンの代表色は `(v<<3)+4`。代表色から、許可されたビーズのうち OKLab で一番近いものを求めて表に入れる

- [ ] **Step 4: テストが通ることを確認する**（Expected: PASS）

- [ ] **Step 5: Commit**（`feat(core): add 5-bit nearest-bead LUT`）

### Task 5: シート、プレートへの分割、個数の集計

**Files:**
- Create: `src/core/sheet/sheet.ts`、`src/core/sheet/plates.ts`、`src/core/sheet/counts.ts`
- Test: `src/core/sheet/sheet.test.ts`、`src/core/sheet/plates.test.ts`、`src/core/sheet/counts.test.ts`

**Interfaces:**
- Consumes: Task 3 の `PaletteId`
- Produces:
  - `type SheetSize = 13 | 21 | 29 | 58 | 116`、`PLATE = 29`
  - `interface Sheet { width: number; height: number; cells: Uint8Array; paletteId: PaletteId }`
  - `createSheet(width: number, height: number): Sheet`、`idx(sheet: Sheet, x: number, y: number): number`、`getCell(sheet, x, y): number`（範囲外は 0）、`cloneSheet(s: Sheet): Sheet`、`inBounds(sheet, x, y): boolean`
  - `interface Plate { index: number; col: number; row: number; originX: number; originY: number }`（originX/originY は、シート座標で見たプレートの左上）
  - `plateGrid(size: SheetSize): { cols: number; rows: number }`、`platesOf(sheet: Sheet): Plate[]`、`plateCell(sheet: Sheet, plate: Plate, px: number, py: number): number`（px, py は 0..28。シートの外は 0）
  - `interface BeadCount { index: number; count: number }`、`countBeads(sheet: Sheet, plate?: Plate): BeadCount[]`（count の降順、同数なら index の昇順。0 は含めない）

- [ ] **Step 1: テストを書く**

```ts
test("plateGrid", () => {
  expect(plateGrid(13)).toEqual({cols:1,rows:1}); expect(plateGrid(29)).toEqual({cols:1,rows:1});
  expect(plateGrid(58)).toEqual({cols:2,rows:2}); expect(plateGrid(116)).toEqual({cols:4,rows:4});
});
test("platesOf 116 order is row-major", () => {
  const p = platesOf(createSheet(116,116)); expect(p).toHaveLength(16);
  expect(p[1]).toMatchObject({index:1,col:1,row:0,originX:29,originY:0});
  expect(p[4]).toMatchObject({index:4,col:0,row:1,originX:0,originY:29});
});
test("13 sheet sits top-left of a 29 plate", () => {
  const s = createSheet(13,13); s.cells[idx(s,12,12)] = 5; const [pl] = platesOf(s);
  expect(plateCell(s, pl, 12, 12)).toBe(5); expect(plateCell(s, pl, 13, 0)).toBe(0); expect(plateCell(s, pl, 28, 28)).toBe(0);
});
test("countBeads counts white bead (V7 regression)", () => {
  const s = createSheet(3,1); s.cells.set([1, 1, 18]); // 1 = 5001 しろ
  expect(countBeads(s)).toEqual([{index:1,count:2},{index:18,count:1}]);
});
test("countBeads per plate and empty sheet", () => {
  expect(countBeads(createSheet(29,29))).toEqual([]);
  const s = createSheet(58,58); s.cells[idx(s,30,0)] = 3; const p = platesOf(s);
  expect(countBeads(s,p[0])).toEqual([]); expect(countBeads(s,p[1])).toEqual([{index:3,count:1}]);
});
```

- [ ] **Step 2: テストが失敗することを確認する**（Run: `npx jest src/core/sheet`、Expected: FAIL）
- [ ] **Step 3: 実装する**（`createSheet` の `paletteId` は `"perler-32"`）
- [ ] **Step 4: テストが通ることを確認する**（Expected: PASS）
- [ ] **Step 5: Commit**（`feat(core): add sheet model, plate split and bead counts`）

### Task 6: 編集操作（変更差分を返す純粋関数）

**Files:**
- Create: `src/core/sheet/ops.ts`
- Test: `src/core/sheet/ops.test.ts`

**Interfaces:**
- Consumes: Task 5 の `Sheet`、`idx`、`inBounds`
- Produces:
  - `interface CellChange { i: number; before: number; after: number }`
  - `applyChanges(sheet: Sheet, changes: readonly CellChange[], dir: "forward" | "backward"): void`
  - `paintCells(sheet, cells: readonly [number, number][], value: number): CellChange[]`（ペン、消しゴム、選択した範囲の色変更・削除で共用する。値が変わらないマスは差分に含めない。同じマスが重複していたら1件にする）
  - `rectCells(a: [number, number], b: [number, number]): [number, number][]`（2点を含む矩形。順序は問わない）
  - `lineCells(a: [number, number], b: [number, number]): [number, number][]`（Bresenham の線。なぞりの補間用）
  - `floodFill(sheet, x: number, y: number, value: number): CellChange[]`（上下左右の4方向）
  - `outline(sheet, value: number, thickness: 1 | 2): CellChange[]`
  - 関数はすべて sheet を変更しない（差分を計算するだけ）

- [ ] **Step 1: テストを書く**

```ts
test("floodFill is 4-connected", () => {
  // 1 0
  // 0 1  → (0,0) を 5 にしても (1,1) は変わらない
  const s = sheetFrom([[1,0],[0,1]]); const ch = floodFill(s,0,0,5);
  expect(ch).toEqual([{i:0,before:1,after:5}]);
});
test("floodFill on background region", () => {
  const s = sheetFrom([[0,0,1],[0,1,0]]); expect(floodFill(s,0,0,4).map(c=>c.i).sort()).toEqual([0,1,3]);
});
test("floodFill same value → no changes", () => { expect(floodFill(sheetFrom([[2]]),0,0,2)).toEqual([]); });
test("outline thickness 1 paints exterior ring (4-neighbors) only", () => {
  const s = sheetFrom([[0,0,0],[0,7,0],[0,0,0]]); const ch = outline(s, 18, 1);
  expect(ch.map(c=>c.i).sort((a,b)=>a-b)).toEqual([1,3,5,7]);
});
test("outline thickness 2 grows twice", () => {
  const s = createSheet(5,5); s.cells[idx(s,2,2)] = 7;
  expect(outline(s,18,2)).toHaveLength(4 + 8); // 1周目4、2周目8（4近傍のダイヤ形）
});
test("outline: object touching edge", () => {
  const s = sheetFrom([[7,0],[0,0]]); expect(outline(s,18,1).map(c=>c.i).sort()).toEqual([1,2]);
});
test("outline: interior hole untouched", () => {
  const s = sheetFrom([[0,0,0,0,0],[0,7,7,7,0],[0,7,0,7,0],[0,7,7,7,0],[0,0,0,0,0]]);
  expect(outline(s,18,1).some(c=>c.i===idx(s,2,2))).toBe(false);
});
test("applyChanges forward/backward roundtrip", () => {
  const s = sheetFrom([[1,2]]); const ch = paintCells(s, [[0,0],[1,0],[0,0]], 3);
  expect(ch).toHaveLength(2); applyChanges(s,ch,"forward"); expect([...s.cells]).toEqual([3,3]);
  applyChanges(s,ch,"backward"); expect([...s.cells]).toEqual([1,2]);
});
test("rectCells normalizes corners", () => { expect(rectCells([1,1],[0,0])).toHaveLength(4); });
test("lineCells covers diagonal endpoints", () => { expect(lineCells([0,0],[3,3])).toEqual([[0,0],[1,1],[2,2],[3,3]]); });
```
（`sheetFrom(rows: number[][]): Sheet` は、テスト用のヘルパーとして `src/core/sheet/testing.ts` に置き、export する）

- [ ] **Step 2: テストが失敗することを確認する**（Expected: FAIL）
- [ ] **Step 3: 実装する**

`outline` の手順：
1. 外周の背景マスを起点に、上下左右の4方向へ塗りつぶすように探して「外部の背景」を求める
2. 外部の背景のうち、背景以外のマスと4方向で隣り合うマスを1周目とする
3. thickness 2 のときは、1周目を「背景以外」とみなして、2の手順をもう1回行う

- [ ] **Step 4: テストが通ることを確認する**（Expected: PASS）
- [ ] **Step 5: Commit**（`feat(core): add paint, flood fill, outline ops returning cell diffs`）

### Task 7: Undo/Redo

**Files:**
- Create: `src/core/history/history.ts`
- Test: `src/core/history/history.test.ts`

**Interfaces:**
- Consumes: Task 6 の `CellChange`、`applyChanges`
- Produces: `class History { constructor(limit = 200); push(changes: readonly CellChange[]): void; undo(sheet: Sheet): boolean; redo(sheet: Sheet): boolean; get canUndo(): boolean; get canRedo(): boolean; clear(): void }`（push は、変更を**適用済み**の差分を受け取る）

- [ ] **Step 1: テストを書く**

```ts
test("undo/redo restores cells", () => { /* paint→apply→push→undo で元に戻り、redo で再適用される */ });
test("push after undo clears redo", () => { /* undo のあとに push すると canRedo が false */ });
test("empty change set is ignored", () => { h.push([]); expect(h.canUndo).toBe(false); });
test("limit 200 drops oldest", () => { for 201 回 push; 200 回 undo が true、201 回目は false });
```
（各テストの本体は、コメントのとおり `paintCells` と `applyChanges` で組み立てる）

- [ ] **Step 2: テストが失敗することを確認する** → **Step 3: 実装する** → **Step 4: テストが通ることを確認する**
- [ ] **Step 5: Commit**（`feat(core): add bounded undo/redo history`）

### Task 8: 変換の型、作業用解像度への縮小、背景の判定

**Files:**
- Create: `src/core/convert/types.ts`、`src/core/convert/resample.ts`、`src/core/convert/background.ts`、`src/core/convert/testing.ts`（テスト用に画像を組み立てるヘルパー）
- Test: `src/core/convert/resample.test.ts`、`src/core/convert/background.test.ts`

**Interfaces:**
- Produces:
  - `interface RgbaImage { width: number; height: number; data: Uint8ClampedArray }`
  - 仕様書 §4 の `ConvertSettings` をそのまま定義する。`defaultConvertSettings(size: SheetSize = 29): ConvertSettings` の初期値は次のとおり：`preset "illust"`、`allowedBeads ALL32`、`maxColors 32`、`noise 1`、`removeBackground true`、`backgroundTolerance 0.08`、`lineThreshold 0.25`、`dither false`
  - `WORK_CELL_PX = 8`
  - `fitToWork(img: RgbaImage, size: SheetSize, cellPx = WORK_CELL_PX): { work: RgbaImage; cellsW: number; cellsH: number }`。縦横比を保って `size*cellPx` の正方形に収め、左上に寄せる。`work` の大きさは `cellsW*cellPx × cellsH*cellPx`。cellsW と cellsH は1以上
  - `backgroundMask(img: RgbaImage, removeBackground: boolean, tolerance: number): Uint8Array`（1 = 背景）
  - `testing.ts`：`solid(w, h, rgba): RgbaImage`、`drawRect(img, x, y, w, h, rgba): void`

- [ ] **Step 1: テストを書く**

```ts
test("fitToWork landscape 200x100 into 29", () => {
  const r = fitToWork(solid(200,100,[255,0,0,255]), 29); expect([r.cellsW, r.cellsH]).toEqual([29,14]);
  expect(r.work.width).toBe(232); expect(r.work.height).toBe(112);
});
test("fitToWork: extreme aspect keeps at least 1 cell", () => {
  const r = fitToWork(solid(3000,40,[0,0,0,255]), 29); expect(r.cellsH).toBeGreaterThanOrEqual(1);
});
test("alpha < 128 is background regardless of flag", () => {
  const img = solid(4,4,[255,0,0,255]); img.data[3] = 0; expect(backgroundMask(img,false,0.08)[0]).toBe(1);
});
test("border-connected similar color is background when enabled", () => {
  const img = solid(10,10,[250,250,250,255]); drawRect(img,3,3,4,4,[255,0,0,255]);
  const m = backgroundMask(img,true,0.08); expect(m[0]).toBe(1); expect(m[5*10+5]).toBe(0);
  expect(backgroundMask(img,false,0.08)[0]).toBe(0);
});
test("backgroundMask: dark outline not connected to border survives", () => {
  const img = solid(12,12,[0,0,0,255]); drawRect(img,2,2,8,8,[255,255,0,255]); drawRect(img,4,4,4,4,[0,0,0,255]);
  const m = backgroundMask(img,true,0.08); expect(m[0]).toBe(1); expect(m[5*12+5]).toBe(0); // 内側の黒は残る
});
```

- [ ] **Step 2: テストが失敗することを確認する** → **Step 3: 実装する**

- `fitToWork`：面積平均で縮小する（各出力ピクセルに対応する入力の矩形を平均する。アルファ値も平均する）
- `backgroundMask`：外周のピクセルを起点に、上下左右の4方向へたどる。隣接ピクセルとの OKLab 距離が `tolerance` 以下で、かつ起点の色との距離が `tolerance*2` 以下なら背景として広げる

- [ ] **Step 4: テストが通ることを確認する**
- [ ] **Step 5: Commit**（`feat(core): add convert types, work-resolution fit and background mask`）

### Task 9: 輪郭線の検出とマスの代表色

**Files:**
- Create: `src/core/convert/lines.ts`、`src/core/convert/cells.ts`
- Test: `src/core/convert/lines.test.ts`、`src/core/convert/cells.test.ts`

**Interfaces:**
- Consumes: Task 4 の `buildNearestLut`、`nearestIndex`。Task 8 の `RgbaImage`、`backgroundMask` の結果
- Produces:
  - `lineMask(img: RgbaImage, bg: Uint8Array): Uint8Array`（1 = 線。条件は `L < mean5x5(L) - 0.12` かつ `L < 0.5`。背景のピクセルは対象外で、平均の計算にも含めない）
  - `assignCells(work: RgbaImage, cellsW: number, cellsH: number, cellPx: number, bg: Uint8Array, lines: Uint8Array | null, allowed: readonly number[], lineThreshold: number): { cells: Uint8Array; lineCells: Uint8Array }`

- [ ] **Step 1: テストを書く**

```ts
test("mode not mean: half black half yellow cell picks one of them, not brown", () => {
  // 8x8 の1マスのうち、左の5列が黄色、右の3列が黒 → 黄色を選ぶ
});
test("cell with >50% background becomes 0", () => {});
test("thin dark line covering >=25% of cell wins via lineCells", () => {
  // 黄色の地に2px幅の黒線（8x8 の25%）→ 黒、lineCells=1
});
test("lineMask ignores background pixels", () => {});
```
（各テストは `solid` と `drawRect` で 8×8 や 16×8 の画像を作り、`assignCells(..., ALL32, 0.25)` の結果の index を `beadIdx("5003")` や `beadIdx("5018")` と比べる。V7 の平均方式なら茶色（5020）になる入力を使うこと）

- [ ] **Step 2: テストが失敗することを確認する** → **Step 3: 実装する**

`assignCells` の手順：
1. マスごとに、背景ピクセルの割合が 0.5 を超えたら 0 にする
2. そうでなければ、lines があって線ピクセルの割合が `lineThreshold` 以上なら、線ピクセルだけを対象にし、`lineCells` を 1 にする
3. 対象ピクセルを `nearestIndex` でビーズの色に置き換えて、一番多い色を選ぶ。同数のときは、対象ピクセルの平均色の OKLab に近い方を選ぶ

- [ ] **Step 4: テストが通ることを確認する**
- [ ] **Step 5: Commit**（`feat(core): add line detection and mode-based cell assignment`）

### Task 10: 色の絞り込み、ノイズ掃除、2色モード、誤差拡散、convertImage

**Files:**
- Create: `src/core/convert/reduce.ts`、`src/core/convert/denoise.ts`、`src/core/convert/twoColor.ts`、`src/core/convert/dither.ts`、`src/core/convert/convert.ts`
- Modify: `src/core/index.ts`（公開 API を re-export する）
- Test: `src/core/convert/reduce.test.ts`、`src/core/convert/denoise.test.ts`、`src/core/convert/convert.test.ts`

**Interfaces:**
- Consumes: Task 3〜9 のすべて
- Produces:
  - `reduceColors(cells: Uint8Array, maxColors: number): void`（その場で書き換える）
  - `denoise(cells: Uint8Array, w: number, h: number, strength: 0 | 1 | 2, protect: Uint8Array | null): void`
  - `twoColorCells(work, cellsW, cellsH, cellPx, bg, dark: number, light: number, threshold: number): Uint8Array`（threshold は 0..1。マスの平均 L が threshold 以下なら dark）
  - `ditherCells(work, cellsW, cellsH, cellPx, bg, allowed): Uint8Array`（マスの平均色に対して、OKLab で Floyd–Steinberg 誤差拡散）
  - `convertImage(img: RgbaImage, s: ConvertSettings, cellPx = WORK_CELL_PX): Sheet`（シートの大きさは `s.size × s.size`。作業領域の外は 0）

- [ ] **Step 1: テストを書く**

```ts
test("reduceColors merges least-used into nearest remaining", () => { /* 赤×10、黒×10、朱色(5059)×1、maxColors 2 → 朱色が赤になる */ });
test("reduceColors: maxColors above used count is no-op", () => {});
test("reduceColors keeps 0 untouched", () => {});
test("denoise replaces isolated cell with 8-neighbor majority, respects protect", () => {});
test("denoise strength 0 is no-op", () => {});
test("convertImage: fully transparent → empty sheet", () => {
  const sh = convertImage(solid(50,50,[0,0,0,0]), defaultConvertSettings(29));
  expect(sh.width).toBe(29); expect(sh.cells.every(v=>v===0)).toBe(true); expect(countBeads(sh)).toEqual([]);
});
test("convertImage: single allowed bead", () => {
  const s = {...defaultConvertSettings(13), allowedBeads:[beadIdx("5005")], removeBackground:false};
  const sh = convertImage(solid(40,40,[0,0,255,255]), s); expect(new Set(sh.cells)).toEqual(new Set([beadIdx("5005")]));
});
test("convertImage: respects maxColors", () => { /* 4色の縞模様の画像、maxColors 2 → 使用色は2色以下 */ });
test("convertImage: twoColor preset uses only dark/light", () => {});
test("convertImage 116 performance", () => {
  const img = noiseImage(1600,1600); // 疑似乱数（シード固定）
  const t = Date.now(); convertImage(img, defaultConvertSettings(116)); expect(Date.now()-t).toBeLessThan(4000);
});
```
（`noiseImage(w, h, seed=1)` を `src/core/convert/testing.ts` に追加する。CI で時間がかかる場合を考えて、上限は 4000ms とする。実機での目標は仕様書 §5.2 のとおり2秒）

- [ ] **Step 2: テストが失敗することを確認する** → **Step 3: 実装する**

`convertImage` の流れ：
1. `fitToWork` で作業用解像度にする
2. `backgroundMask` で背景を求める
3. preset ごとに処理を分ける
   - `twoColor`：`twoColorCells`
   - `photo`：`dither` がオンなら `ditherCells`、オフなら lines なしで `assignCells`
   - `illust`：`lineMask` を求めてから `assignCells`
4. `reduceColors`（twoColor では実行しない）
5. `denoise`（illust では lineCells を保護する）
6. `s.size` のシートに、左上に寄せて書き込む

- [ ] **Step 4: テストが通ることを確認する**（Run: `npx jest src/core`、Expected: すべて PASS）
- [ ] **Step 5: Commit**（`feat(core): add color reduction, denoise, two-color, dither and convertImage`）

### Task 11: 比較用のテスト環境 `tools/compare`

**Files:**
- Create: `tools/compare/legacy.ts`、`tools/compare/fixtures/make-fixtures.ts`、`tools/compare/run.ts`、`tools/compare/render.ts`、`tools/compare/legacy.test.ts`
- Modify: `package.json`（devDependencies に `tsx`、`pngjs`、`@types/pngjs` を追加。scripts に `"compare": "tsx tools/compare/run.ts"` と `"fixtures": "tsx tools/compare/fixtures/make-fixtures.ts"` を追加）、`.gitignore`（`tools/compare/out/` と `tools/compare/private/`）

**Interfaces:**
- Consumes: `convertImage`、`defaultConvertSettings`、`countBeads`、`beadByIndex`、`RgbaImage`
- Produces:
  - `legacyConvert(img: RgbaImage, size: SheetSize, mode: 16 | 32): Sheet`。V7 の `create_bead_sheet` を再現する：グレー値が10以下を背景として bounding rect で切り抜く → `size/29` 倍に縮小 → 30px のマスの平均 → RGB の距離で最近傍色。サイズ58と116では、V7 の特大シートと同じ15pxのマスを使う
  - CLI：`npm run compare -- [dir=tools/compare/fixtures] [--size 29]` を実行すると、`tools/compare/out/index.html` を出力する（元画像、V7、新方式を並べ、それぞれに色数と粒数を表示する）

- [ ] **Step 1: テストを書く**

```ts
test("legacy averages a black/yellow split cell into a non-black non-yellow bead", () => {
  // 30x30 の左半分が黒、右半分が黄色（size 29、mode 32）→ 結果は 5018 でも 5003 でもない（V7 の濁り方を再現できていることの確認）
});
test("legacy trims near-black border region (V7 behaviour)", () => {});
```

- [ ] **Step 2: テストが失敗することを確認する** → **Step 3: 実装する**

`make-fixtures.ts` は、**自作の合成画像**だけを作る（例：輪郭のある顔、細い線の星、グラデーション、黒地の黒輪郭キャラ、透過 PNG のキャラ）。出力先は `tools/compare/fixtures/*.png` で、生成した PNG もコミットする。`render.ts` は、シートを1マス12pxの PNG に描き（V7 と同じ丸、背景は点）、base64 で HTML に埋め込む。`tools/compare/private/` に置いた画像（オーナーから提供された非公開の画像）も、`--dir` で指定して比較できるようにする

- [ ] **Step 4: 実行して確認する**

Run: `npm run fixtures && npm run compare && npx jest tools`
Expected: テストが PASS。`tools/compare/out/index.html` ができて、fixture の数×3枚の画像が並ぶ

- [ ] **Step 5: 比較結果をオーナーに見せる**

Playwright で `out/index.html` のスクリーンショット（deviceScaleFactor 2）を撮って、オーナーに送る

- [ ] **Step 6: Commit し、push して PR を出し、CI が通ったら squash でマージする**

```bash
git add -A && git commit -m "feat(tools): add legacy-vs-new conversion comparison harness"
git push -u origin feat/m1-core
```
