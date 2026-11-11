# M5 文字から作る・書き出し・読み込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 次の4つを作る（仕様書 §3.1、§3.2、§4.2、§6.1 ⑥、§10 M5）。
- 「文字から作る」
- ⑥ 書き出し（PNG、実寸の型紙 PDF と印刷、`.beads`、必要数のテキスト）
- `.beads` の読み込み（ファイルを選ぶ、AirDrop などの「このアプリで開く」）
- オーナーの決定：**58/116 の左右反転はシート全体で行う**（プレートの並びも入れ替える）

**Architecture:**
- 文字のレイアウト、文字の形からマスへの変換、`.beads` の圧縮と展開・検証、印刷用 HTML（SVG で実寸）、必要数のテキスト、反転時のプレートの位置の対応は、`src/core` の純粋関数にして Jest でテストする
- 文字の形の描画（iOS は Skia、Web は canvas）、ファイルの書き出しと共有（expo-file-system、expo-sharing、expo-print）、ファイルの選択（expo-document-picker）、外から開いたファイルの受け取り（expo-linking）は `src/platform` に置く

**Tech Stack:** M4 と同じ ＋ expo-sharing、expo-print、expo-document-picker、expo-linking（すべて 58.x）、fflate 0.8

**Spec:** `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md`

## オーナーの決定（2026-11-11）
- 文字のフォント：**太い角ゴシック** → UI と同じ BIZ UDPゴシック Bold を使う（すでに同梱、OFL）
- PDF：**A4 にプレート1枚分を実寸（5mm マス）で印刷する型紙 ＋ 最後のページに必要数**
- 左右反転：**シート全体で反転**（左上のプレートが右上に移る）
- iOS のアプリ ID：**あとで決める（M6 の最初にリマインドする）**。ID に関わる値は `src/core/appIdentity.ts` の1か所にまとめる

## Global Constraints
- M0〜M4 の Global Constraints はすべて引き続き有効
- 文字の大きさ：29 マスで全角1文字 = 14×14 マス、半角 = 7×14 マス（V7 と同じ）。ほかのサイズは `round(size × 14 / 29)` で同じ比率にする。入る文字数を超える入力は受け付けない
- `.beads` = zip（fflate）。中身は `project.json`（`serializeProject` と同じ形）と、元画像があれば `source.png`。読み込むときは**新しい id を振る**（同じ作品を2回読み込んでもぶつからないように）
- PDF：A4 縦（210×297mm）。1ページにプレート1枚、マスは **5mm 実寸**、中央に配置する。品番を凡例として付ける。最後のページに必要数の表。印刷の倍率は「100%」にするよう、ページ内に注記を入れる
- 共有は expo-sharing の共有シートを使う（写真ライブラリへの保存も共有シートから行える。写真への書き込み権限は求めない）
- Web（自動テスト用）では、共有はダウンロード、印刷は `window.print` の代わりに HTML を新しいタブで開く

## Review Focus
1. **入る文字数を超える入力**（例：29 マスで全角3文字）→ 入力の時点で止める。プレビューと作成ボタンは、超えた状態では無効（Task 1 `fits rejects too many chars`）
2. **壊れた `.beads`、別のアプリの zip、未来のバージョン** → 読み込みを中止して理由を表示する。ほかの作品は壊さない（Task 4 `parseBeads rejects`）
3. **同じ `.beads` を2回読み込む** → 別の作品として2つできる（新しい id）（Task 4 `import assigns a new id`）
4. **116 マスの PDF**（16 ページ＋必要数）→ ページの数と、マスが 5mm であることを検証する（Task 5 `print html 116 has 17 pages and 5mm cells`）
5. **58/116 で反転中にミニマップでプレートを選ぶ** → 見た目の位置のプレートが出る（データ上は左右が逆のプレート）。タイトルの「プレート i/N」は見た目の番号（Task 9 `visualPlate maps mirrored columns`）

---

### Task 1: 文字のレイアウト（core）
**Files:** Create `src/core/text/layout.ts`、Test `src/core/text/layout.test.ts`
**Produces:**
- `isHalfWidth(ch: string): boolean`（0x20–0x7E と半角カナ 0xFF61–0xFF9F）
- `textLayout(text: string, size: SheetSize): { charH: number; widths: number[]; totalW: number; fits: boolean; maxFull: number }`（charH = round(size×14/29)、全角の幅 = charH、半角の幅 = round(charH/2)）
- `maskToCells(mask: Uint8Array, maskW: number, maskH: number, cellPx: number, textBead: number, bgBead: number, threshold = 0.5): Uint8Array`（文字の形の不透明度の割合が threshold 以上なら textBead。bgBead=0 なら背景）
- `placeText(cells: Uint8Array, w: number, h: number, size: SheetSize): Sheet`（size×size のシートの中央に置く）
**Tests:**
- `29: 2 full chars fit, 3 do not`（全角 28 マス）
- `29: 4 half chars fit`
- `58 doubles char height`
- `maskToCells threshold`
- `placeText centres`
- `fits rejects too many chars`（"あいう" は fits=false）

### Task 2: 文字の形の描画（platform）
**Files:** Create `src/platform/textMask.ts`（iOS：Skia。フォントのデータを `Skia.Data.fromURI(Asset.fromModule(ttf).localUri)` で読み、`Skia.Typeface.MakeFreeTypeFaceFromData` で書体にする。オフスクリーンの Surface に白地に黒で描き、アルファ値を取り出す）、`src/platform/textMask.web.ts`（canvas 2D、`font: 700 Npx BIZUDPGothic_700Bold`）
**Produces:** `renderTextMask(text: string, layout: ReturnType<typeof textLayout>, cellPx: number): Promise<{ mask: Uint8Array; w: number; h: number }>`（各文字は、その文字の幅の箱の中央に描く。上下は charH の 0.88 倍の大きさで中央に）
- 単体テストはしない。Task 10 の E2E で、Web 版の作成結果のマス数を確認する

### Task 3: 文字から作る画面
**Files:** Create `src/app/new/text.tsx`、Modify `src/app/new/index.tsx`（「文字から作る」を有効にする）
- 入力欄：最大文字数を `textLayout` で判定し、超える入力は受け付けない
- サイズ（13/21/29/58/116）、文字の色、背景（「なし」＝0、またはビーズの色）。色は `BeadOnePicker` で選ぶ
- プレビュー（SheetCanvas）、「作成」
- 「作成」で `stage: 'edit'` の作品として保存し、`/project/[id]` へ移る
- スクロールしない。キーボードが開いても、操作に必要な部分が隠れない（`KeyboardAvoidingView`）

### Task 4: `.beads` の圧縮と展開（core）
**Files:** Create `src/core/file/beads.ts`、Test `src/core/file/beads.test.ts`
**Produces:**
- `packBeads(p: Project, sourcePng: Uint8Array | null): Uint8Array`（`fflate.zipSync`。`project.json` と `source.png`、加えて `mimetype` ファイル `application/x-digital-iron-beads`）
- `class BeadsError extends Error`（`reason: 'not-zip' | 'not-beads' | 'bad-project' | 'future-version'`）
- `unpackBeads(bytes: Uint8Array, now: Date): { project: Project; sourcePng: Uint8Array | null }`（新しい id、createdAt/updatedAt = now、stage は source があれば元のまま、なければ 'edit'、nav は消す）
**Tests:**
- `pack → unpack roundtrip keeps sheet and name`
- `import assigns a new id`
- `parseBeads rejects random bytes / zip without project.json / future version`
- `missing source becomes stage edit`

### Task 5: 印刷用 HTML と必要数のテキスト（core）
**Files:** Create `src/core/export/print.ts`、`src/core/export/countsText.ts`、Tests
**Produces:**
- `buildPrintHtml(sheet: Sheet, name: string): string`
  - 1プレート = 1ページの `<section class="page">`
  - SVG の大きさは `width="145mm" height="145mm" viewBox="0 0 29 29"`。ビーズは r=0.45 の円、背景は小さな点、プレートの外は空ける
  - 品番の凡例と、「印刷の倍率は 100%（実際のサイズ）にしてください」の注記
  - 最後に必要数の表のページ
- `countsText(name: string, sheet: Sheet): string`（「作品名\n必要なビーズ（N色・M粒）\n5005 あか 62\n…」）
**Tests:**
- `print html 29 has 2 pages`
- `print html 116 has 17 pages and 5mm cells`
- `print html escapes the name`
- `countsText lists codes by count`

### Task 6: 書き出しの実処理（platform）
**Files:** Create `src/platform/exporter.ts`、`src/platform/exporter.web.ts`
**Produces:**
- `sharePng(sheet: Sheet, name: string, mirror: boolean): Promise<void>`：1マス 24px で描く。iOS は Skia の Surface で描いて PNG にし、cache に保存して `shareAsync`。Web はダウンロード
- `printPdf(html: string): Promise<void>`：iOS は `Print.printAsync({ html })`。Web は新しいタブで開く
- `sharePdf(html: string, name: string): Promise<void>`：iOS は `printToFileAsync({ html, width: 595, height: 842 })` → `shareAsync`。Web はダウンロード
- `shareBeads(bytes: Uint8Array, name: string): Promise<void>`
- `shareText(text: string): Promise<void>`：React Native の `Share.share`。Web はクリップボード

### Task 7: ⑥ 書き出し画面と入口
**Files:** Create `src/app/export/[id].tsx`、Modify `src/app/project/[id].tsx`（「表示」メニューに「書き出し・共有」を追加）
- ボタン：「画像（PNG）で共有」、「型紙を印刷」、「型紙を PDF で共有」、「.beads ファイルで共有（ほかの端末に渡す）」、「必要なビーズをテキストで共有」
- 必要数の表を表示する（この一覧の中だけスクロールする）
- 書き出しに失敗したら `notify('書き出せませんでした', …)`

### Task 8: 読み込み（ファイルを選ぶ・このアプリで開く）
**Files:** Create `src/state/importer.ts`（`importBeads(repo, bytes, now): Promise<string>`）、`src/platform/incoming.ts`（`readFileBytes(uri)`）、Test `src/state/importer.test.ts`、Modify `src/app/index.tsx`（「読み込み」ボタン）、`src/app/_layout.tsx`（`Linking.useLinkingURL()` で `.beads` を受け取る）、`app.json`（`ios.infoPlist` に `CFBundleDocumentTypes` と `UTExportedTypeDeclarations`。UTI と拡張子 `beads` は `src/core/appIdentity.ts` の値と同じにする）
- 読み込みに成功したら、作品を開く（stage が setup なら ③、edit なら ④）。失敗したら理由を表示する
- 理由の文言
  - not-zip / not-beads：「デジタル・アイロンビーズのファイルではありません」
  - bad-project：「ファイルが壊れています」
  - future-version：「新しいバージョンのアプリで作られたファイルです。アプリを更新してください」
**Tests:**
- `importBeads saves project and source`
- `import twice gives two projects`
- `bad file throws BeadsError and saves nothing`

### Task 9: 左右反転をシート全体で行う（オーナーの決定）
**Files:** Modify `src/core/sheet/plates.ts`（`visualPlate`）、`src/ui/PlateMiniMap.tsx`、`src/ui/SheetThumb.tsx`（mirror）、`src/app/nav/[id].tsx`、`src/app/project/[id].tsx`、Test `src/core/sheet/plates.test.ts`
**Produces:**
- `mirrorPlateIndex(plates: Plate[], i: number): number`（同じ行で、列を cols-1-col にしたプレートの番号）
- 反転中は、ミニマップのタイルを左右逆に並べる（それぞれのサムネイルも反転）。タップした見た目の位置のプレートを表示する（データ上は `mirrorPlateIndex`）
- タイトルの「プレート i/N」は、見た目の番号で表示する
**Tests:**
- `visualPlate maps mirrored columns`（2×2 と 4×4。0↔1、4↔7 など）

### Task 10: E2E と実機確認リスト
**Files:** Create `e2e/m5-text-export.cjs`、`docs/checklists/m5-device.md`、Modify `package.json`
- E2E（Web）
  1. 文字から作る「AB」（29、文字色 5018、背景なし）→ 作品画面で 0 より多い粒数、1色
  2. 全角3文字で「作成」が無効になる
  3. 書き出し画面で .beads をダウンロード → その bytes を読み込み（ホームの「読み込み」で file chooser に渡す）→ 作品が2つになる（id が違う）
  4. 壊れたファイルを読み込むと、理由が表示される
  5. 印刷用 HTML が開き、`section.page` の数がプレート数＋1
  6. 58 の作品で反転して、ミニマップの「プレート 1」（見た目の左上）を押すと、タイトルが「プレート 1/4」になり、データ上はプレート 2（右上）の色が出る
  7. 各画面がスクロールしない
- 実機確認リスト：PNG を写真に保存、印刷を 100% にして型紙が 145mm になるか、AirDrop で別の端末から `.beads` を開けるか、「ファイル」アプリから開けるか

## M6 へ申し送り
- **M6 の最初に、iOS のアプリ ID を決めてもらう**（今は `com.oshima1214.digitalironbeads` の仮の値。`src/core/appIdentity.ts` と `app.json`）
