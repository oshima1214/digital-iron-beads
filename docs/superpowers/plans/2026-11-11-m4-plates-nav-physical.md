# M4 プレート分割・制作ナビ・iPad 実寸表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 58/116 のシートをプレート単位で扱えるようにする（ミニマップで切り替え）。⑤ 制作ナビ（色ごとの前へ／次へ、色の一覧から直接移動、左右反転、進み具合の保存）を作る。iPad では 1プレート（29マス＝145mm）を実寸で固定表示し、設定画面で実物に合わせて微調整できるようにする。iPad mini は横向きで、上半分と下半分を切り替えて表示する（仕様書 §6.1、§6.2、§6.3、§6.4、§10 M4）。

**Architecture:**
- 実寸の計算（機種の表、mm → pt、収まるかどうか、半分表示）は純粋関数（`src/core/physical.ts`）にして Jest でテストする
- 機種の判別（expo-device）と微調整の保存は `src/platform` に置く
- 制作ナビの状態は zustand の `nav` ストアに置き、進み具合は `Project.nav` として自動保存する
- 描画は `paintSheet` に「プレートの範囲」と「強調する色」のオプションを足す
- iPad の画面配置（縦向きはパネルが上・シートが下、横向きはシートが左・パネルが右、左右は入れ替え可能）は `useDeviceLayout` フックにまとめる

**Tech Stack:** M3 と同じ ＋ expo-device

**Spec:** `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md`

## Global Constraints
- M0〜M3 の Global Constraints はすべて引き続き有効
- 1マス = 5mm、1プレート = 29マス = 145mm
- ポイント密度：iPad mini は 163pt/inch、そのほかの iPad は 132pt/inch。Web（自動テスト用）は CSS の 96px/inch
- 1マスのポイント数 = `5 / 25.4 × ptPerInch × 補正係数`
- 補正係数は 0.90〜1.10。微調整画面の刻みは 0.002
- iPad の ④ 編集と ⑤ ナビは、プレートを実寸で固定表示する（ズームも移動もしない）
- ⑤ ナビでは、iPad のシート領域へのタッチを無効にする（`pointerEvents="none"`）
- iPhone は実寸にしない（箱に収める）。⑤ ナビは iPhone でも、1プレートを箱に収めて表示する
- ナビの表示：今の色は実際の色の丸（マスの 0.98）、ほかのビーズは `#D1D1D6` の小さな丸（マスの 0.4）、背景は今までどおりの点

## Review Focus
1. **表にない iPad の機種、または modelId が null** → modelName に "mini" が含まれるかで 163 か 132 を選ぶ。微調整が保存されていなければ、初めて実寸表示するときに設定画面へ誘導する（Task 1 `unknown model falls back by name`、Task 4）
2. **iPad mini の縦向き** → 145mm が入らないので「横向きにしてください」と表示する。横向きでも高さが足りないので、上半分と下半分を切り替える（Task 1 `fitPlate on mini`、Task 6）
3. **58/116 で、色が1つもないプレート** → ナビはそのプレートを「ビーズなし」と表示して、次のプレートへ進める。落ちない（Task 3 `empty plate`）
4. **ナビの途中で作品を編集して戻る**（色が増えた・減った） → 保存しておいた colorIndex が範囲外にならないよう、範囲内に収める（Task 3 `clamps saved position`）
5. **補正係数の保存に失敗、または壊れた settings.json** → 補正係数 1.0 で表示し、落ちない（Task 2）

---

### Task 1: 実寸の計算（core）
**Files:** Create `src/core/physical.ts`、Test `src/core/physical.test.ts`
**Produces:**
- `CELL_MM = 5`
- `ptPerInchFor(modelId: string | null, modelName: string | null, isWeb: boolean): { ptPerInch: number; known: boolean }`（iPad mini の modelId：`iPad5,1` `iPad5,2` `iPad11,1` `iPad11,2` `iPad14,1` `iPad14,2` `iPad16,1` `iPad16,2`。そのほかの "iPad" で始まる ID は 132 で known）
- `cellPt(ptPerInch: number, factor: number): number`
- `fitPlate(cell: number, boxW: number, boxH: number): { fits: 'full' | 'half' | 'none'; rows: number }`（29マスが箱に収まれば full。幅だけ収まり、15行以上が収まれば half（rows = 収まる行数、最大29）。それ以外は none）
- `halfRows(part: 0 | 1, rows: number): [number, number]`（上半分は 0..rows、下半分は 29-rows..29）
**Tests:**
- `132pt/inch iPad → cell 25.98pt`
- `mini ids → 163`
- `unknown model falls back by name`（"iPad mini (A99)" → 163 で known=false、"iPad Pro (M9)" → 132 で known=false、null → 132 で known=false）
- `web → 96`
- `fitPlate on 11-inch portrait → full`
- `fitPlate on mini landscape → half`（744pt の高さで rows ≥ 15）
- `fitPlate on mini portrait → none`
- `halfRows`

### Task 2: 設定（補正係数・パネルの左右）の保存
**Files:** Create `src/platform/settingsRepo.ts`（iOS: `Paths.document/settings.json`）、`src/platform/settingsRepo.web.ts`（localStorage）、`src/state/settings.ts`、Test `src/state/settings.test.ts`
**Produces:**
- `interface AppSettings { calibration: number; calibrated: boolean; panelSide: 'left' | 'right' }`
- `DEFAULT_SETTINGS = { calibration: 1, calibrated: false, panelSide: 'right' }`
- `parseSettings(json: string): AppSettings`：壊れていたら既定値。calibration は 0.90..1.10 に収める
- `createSettingsStore(repo)`：`load()`、`setCalibration(v)`（calibrated=true にする）、`setPanelSide(side)`、`reset()`。変更のたびに保存する。保存に失敗しても状態は保つ
- `useSettings`
**Tests:**
- `parse broken json → defaults`
- `calibration clamped`
- `setCalibration persists and marks calibrated`
- `save failure keeps state`

### Task 3: 制作ナビのストア
**Files:** Create `src/state/nav.ts`、Test `src/state/nav.test.ts`
**Produces:**
- `createNavStore(repo, now?, autosaveMs?)`
- 状態：`project`、`plates: Plate[]`、`plateIndex`、`order: BeadCount[]`（今のプレートの色。多い順）、`colorIndex`、`done: boolean`、`mirror`、`half: 0 | 1`
- 操作：`open(id)`、`next()`、`prev()`、`jump(i)`、`setPlate(i)`、`toggleMirror()`、`setHalf(h)`、`close()`
- ルール
  - 最後の色で `next()` すると `done = true`。done のときの `prev()` で最後の色に戻る
  - プレートを切り替えたら colorIndex=0、done=false にする
  - 位置が変わるたびに `project.nav = { plateIndex, colorIndex }` を自動保存の予約に入れる
  - `open` のときは、保存しておいた位置を範囲内に収める
  - 色のないプレートは order=[]、done=false にする（画面で「ビーズなし」と表示する）
**Tests:**
- `next/prev/jump/done`
- `setPlate resets color`
- `saves nav position`
- `clamps saved position`
- `empty plate`
- `open restores saved position`

### Task 4: 描画の拡張（プレートの範囲・強調する色）とミニマップ
**Files:** Modify `src/ui/sheetPaint.ts`、`src/ui/SheetCanvas.tsx`、Create `src/ui/PlateMiniMap.tsx`
- `PaintOptions` に追加
  - `region?: { x: number; y: number; w: number; h: number }`（描くマスの範囲。キャンバスの原点がこの範囲の左上になる。シートの外は背景として描く）
  - `focus?: number`（強調する色。ほかのビーズは `#D1D1D6` の 0.4 の丸で描く）
  - mirror は範囲の中で反転する
- `PlateMiniMap`：プレートの格子（2×2 や 4×4）を小さな四角で並べる。今のプレートは `colors.accent` の枠。タップで `onSelect(i)`。各プレートの中は SheetThumb の縮小版で表示する
- 単体テストはしない（Task 9 の E2E とスクリーンショットで確認）

### Task 5: 画面配置のフック（iPad の実寸）
**Files:** Create `src/ui/useDeviceLayout.ts`、`src/platform/device.ts`（`isPad`、`modelId`、`modelName` を集めたもの。Web は false/null）
**Produces:**
- `useDeviceLayout()` → `{ isPad: boolean; landscape: boolean; physicalCell: number | null; panelSide: 'left' | 'right' }`
  - physicalCell は iPad のときだけ、`cellPt(ptPerInchFor(...), settings.calibration)`
  - Web は `?pad=1` の URL パラメーターで iPad として扱う（E2E 用）
- `PlateStage` コンポーネント：iPad なら実寸で、iPhone なら箱に収めてプレートを描く
  - iPad で fitPlate が none のときは「横向きにしてください」
  - half のときは、上半分・下半分の切り替えボタンを出す

### Task 6: ⑤ 制作ナビ画面
**Files:** Create `src/app/nav/[id].tsx`
- 画面配置
  - iPad 縦向き：上にパネル、下に PlateStage
  - iPad 横向き：panelSide に従って、シートとパネルを左右に並べる
  - iPhone：上にパネル、下にシート
- パネルの内容
  - 「‹ 編集」と、作品名・「プレート i/N」
  - ⇋ 反転
  - 「◀ 前へ」と「次へ ▶」
  - 今の色：丸・品番・名前・粒数、「k / M 色め」
  - 色の一覧チップ：タップで jump。testID は `nav-chip-<code>`
  - 58 以上のサイズではミニマップ
  - done のときは「このプレートは完成！」と「次のプレートへ」（最後のプレートなら「すべて完成！」）
- シート：PlateStage（focus = 今の色）。iPad はタッチを無効にする
- 初めて実寸表示するとき（iPad で calibrated=false）は、上部に「実物のプレートに合わせて調整してください」と設定へのリンクを出す

### Task 7: ④ 編集画面の iPad 対応とナビへの入口
**Files:** Modify `src/app/project/[id].tsx`、`src/ui/editor/EditorCanvas.tsx`
- 上部のバーに「ナビ」を追加（→ `/nav/[id]`。移る前に editor を flush する）
- iPad では、EditorCanvas が今のプレートだけを実寸で描き、`viewToCell` の結果にプレートの原点を足す
  - プレートの切り替えはミニマップで行う（58 以上のサイズ）
  - 画面配置はナビと同じ（縦向きはパネルが上）
  - 13/21 は 29 プレートの左上に置く（プレートの外のマスは塗れない＝null）
- iPhone は M3 のまま（シート全体を表示してズームで扱う）

### Task 8: 設定画面（実寸の微調整・パネルの左右・クレジット）
**Files:** Create `src/app/settings.tsx`、Modify `src/app/index.tsx`（左上に「設定」）
- 実寸の微調整
  - 実寸の 100mm の定規（10mm ごとに目盛り）と、プレート1枚分の枠（29マス）を表示する
  - 「−」「＋」ボタン（0.002 刻み）とスライダーで補正係数を変える
  - 「元に戻す」と、今の係数の表示
- 「パネルの位置（iPad 横向き）」：左 / 右
- クレジット
  - 「原案：日本海情報ビジネス専門学校（NiB）」
  - フォント：BIZ UDPゴシック（SIL Open Font License 1.1）
  - 「パーラー対応色番号」の注記
- iPad 以外では、実寸の微調整の欄を「iPad でのみ使います」と表示する

### Task 9: E2E と実機確認リスト
**Files:** Create `e2e/m4-nav.cjs`、`docs/checklists/m4-device.md`、Modify `package.json`
- E2E（Web）
  1. 写真から 58 のシートを作る
  2. 編集から「ナビ」
  3. 次へ・前へ・色のチップへの jump
  4. 最後の色で「完成」
  5. ミニマップでプレート 2 へ
  6. 再読み込みすると、ナビの位置（プレート・色）が戻る
  7. `?pad=1` で iPad として扱い、縦向き（820×1180）でパネルが上・シートが下になっていること、シート領域がタッチを受けないこと（クリックしても状態が変わらない）を確認する
  8. 設定で補正係数を変え、再読み込み後も残っていることを確認する
  9. 各画面がスクロールしないことを確認する
- 実機確認リスト
  1. 定規で 145mm の誤差が ±1mm 以内
  2. プレートを置いて穴と表示がずれない
  3. iPad mini の上半分・下半分の切り替え
  4. 縦向き・横向きでのパネルの位置
  5. プレートを置いたときに誤ってタッチされない
  6. 進み具合の再開

## 仕様書との違い
- iPhone の ⑤ ナビはズームしない（1プレートを箱に収めると十分大きいため）
- Web（自動テスト用）は 96px/inch とし、`?pad=1` で iPad の画面配置にする
