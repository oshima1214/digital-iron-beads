# iPhone の実寸表示（13ビーズ）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 13×13 の作品の「編集」と「ナビ」で、13マスが入る iPhone では実寸表示し、入らない iPhone では注意書きを出す。

**Architecture:** 「実寸にするか」を純粋な関数 `phonePhysical`（`src/core/physical.ts`）で決め、`useDeviceLayout` が iPhone の1マスの大きさ `phoneCell` を出す。`EditorCanvas` と `PlateStage` がその関数で描き方を選び、結果を画面に知らせる。画面は結果が `too-small` のときだけ注意書きを出す。

**Tech Stack:** Expo SDK 58 / React Native 0.88 / expo-device / Skia / Jest / Playwright（Web E2E）

**Spec:** `docs/superpowers/specs/2026-11-26-iphone-physical-13-design.md`

## Global Constraints

- 対象は幅・高さが 13 の作品だけ。21 / 29 / 58 / 116 は今までどおり。
- 対象画面は編集（`src/app/project/[id].tsx`）とナビ（`src/app/nav/[id].tsx`）だけ。シート作成は変えない。
- pt/inch：`iPhone12,8` `iPhone14,6` `iPhone11,8` `iPhone12,1` → 163。`iPhone13,1` `iPhone14,4` → 158.7。そのほか（null 含む）→ 460/3（153.33…）。
- 1マス = `cellPt(ptPerInch, settings.calibration)`（既存）。
- 注意書きの文（そのまま）：`この iPhone は画面が小さいため、実寸では表示できません`
- iPad の動作は変えない。
- Web では URL に `?phone=1` があるときだけ iPhone として扱う（既存の `?pad=1` と同じ考え方）。pt/inch は `?ppi=` があればその値、なければ 96。
- 状態は名前のある union と純粋な関数で表す（AGENTS.md）。`docs/architecture/state-machines.md` を同じ変更で更新する。
- 終わる前に `npx tsc --noEmit`、`npx expo lint`、`npx jest`、`npm run e2e:web` を通す。

## Review Focus

- 実寸のときに 15 / 16 で入らない：左右 12pt の余白を残したまま判定すると 393pt の箱が 369pt になる。→ Task 3・4 の E2E で、余白をなくした箱で判定していることを確かめる（`?ppi=` を 393pt ちょうどで入る値にする）。
- 実寸のときにピンチで拡大できてしまう（iPhone 編集の既存のズーム）。→ Task 3 で `canZoom` を false にし、ズームを IDENTITY に戻す。
- 回転・画面の大きさが変わって入らなくなったとき、注意書きと表示が切り替わる。→ Task 1 のテスト（高さ不足で `too-small`）と、箱が変わるたびに判定し直すこと。
- 実寸のときのタップ位置ずれ：`viewToCell` は `layout.cell` を使うので、実寸の cell を `layout.cell` に入れる。→ Task 3 の E2E で実寸のまま1マス塗って位置を確かめる。
- 21 以上の作品・iPad で何も変わらない。→ Task 1 のテスト（`off`）と既存 E2E（m3 / m4）が通ること。

---

### Task 1: 判定の関数（core）

**Files:**
- Modify: `src/core/physical.ts`
- Test: `src/core/physical.test.ts`
- Modify: `docs/architecture/state-machines.md`

**Interfaces:**
- Produces:
  - `export function phonePtPerInch(modelId: string | null): number`
  - `export type PhonePhysical = 'off' | 'exact' | 'too-small'`
  - `export const PHONE_PHYSICAL_SIZE = 13`
  - `export function phonePhysical(o: { phoneCell: number | null; sheetW: number; sheetH: number; boxW: number; boxH: number }): PhonePhysical`
    - `phoneCell` が null、作品が 13×13 でない、`boxW` か `boxH` が 0 以下 → `'off'`
    - `phoneCell * 13 <= boxW` かつ `<= boxH` → `'exact'`、そうでなければ `'too-small'`

- [ ] **Step 1: 失敗するテストを書く**

```ts
test('phonePtPerInch by model id', () => {
  expect(phonePtPerInch('iPhone12,8')).toBe(163); // SE 2
  expect(phonePtPerInch('iPhone14,6')).toBe(163); // SE 3
  expect(phonePtPerInch('iPhone12,1')).toBe(163); // 11
  expect(phonePtPerInch('iPhone14,4')).toBeCloseTo(158.7, 1); // 13 mini
  expect(phonePtPerInch('iPhone15,4')).toBeCloseTo(153.33, 2); // 15
  expect(phonePtPerInch(null)).toBeCloseTo(153.33, 2);
});

test('phonePhysical: 13 beads fit on iPhone 15 width (393pt) but not iPhone 14 (390pt)', () => {
  const phoneCell = cellPt(phonePtPerInch('iPhone15,4'), 1); // ≈ 30.19pt、13マス ≈ 392.4pt
  const base = { phoneCell, sheetW: 13, sheetH: 13, boxH: 500 };
  expect(phonePhysical({ ...base, boxW: 393 })).toBe('exact');
  expect(phonePhysical({ ...base, boxW: 390 })).toBe('too-small');
  expect(phonePhysical({ ...base, boxW: 393, boxH: 380 })).toBe('too-small');
});

test('phonePhysical: off for iPad / other sizes / before layout', () => {
  const box = { boxW: 500, boxH: 500 };
  expect(phonePhysical({ phoneCell: null, sheetW: 13, sheetH: 13, ...box })).toBe('off');
  expect(phonePhysical({ phoneCell: 30, sheetW: 21, sheetH: 21, ...box })).toBe('off');
  expect(phonePhysical({ phoneCell: 30, sheetW: 13, sheetH: 13, boxW: 0, boxH: 0 })).toBe('off');
});
```

- [ ] **Step 2:** `npx jest src/core/physical.test.ts` → 3つが FAIL（未定義）
- [ ] **Step 3:** `src/core/physical.ts` に上の Interfaces どおり実装する
- [ ] **Step 4:** `npx jest src/core/physical.test.ts` → PASS
- [ ] **Step 5:** `state-machines.md` の「明示している状態機械」に1行足す：名前「iPhone の実寸表示」、場所 `src/core/physical.ts` `phonePhysical`、状態 `off` / `exact` / `too-small`（ほかの値から決まる。保存しない）、使っている画面「編集、制作ナビ」
- [ ] **Step 6:** コミット `feat(core): iPhone の実寸表示を決める関数`

### Task 2: 端末の情報（iPhone の1マス）

**Files:**
- Modify: `src/platform/device.ts`
- Modify: `src/ui/useDeviceLayout.ts`

**Interfaces:**
- Consumes: `phonePtPerInch`, `cellPt`（Task 1・既存）
- Produces:
  - `device.ts`：`export const isPhone: boolean`（Web は `?phone=1` のときだけ true。iOS は `Platform.OS === 'ios' && !Platform.isPad`）
  - `DeviceLayout.phoneCell: number | null`（`isPhone` のときだけ `cellPt(isWeb ? (webPpi ?? 96) : phonePtPerInch(modelId), settings.calibration)`、それ以外は null）

- [ ] **Step 1:** 上のとおり実装する。`needsCalibration` は今のまま（iPad だけ）
- [ ] **Step 2:** `npx tsc --noEmit` → エラーなし
- [ ] **Step 3:** コミット `feat: iPhone の実寸の1マスを出す`

### Task 3: 編集画面

**Files:**
- Modify: `src/ui/editor/EditorCanvas.tsx`
- Modify: `src/app/project/[id].tsx`
- Create: `e2e/m6-phone-physical.cjs`
- Modify: `package.json`（`e2e:web` の最後に `&& NODE_PATH=$(npm root -g) node e2e/m6-phone-physical.cjs` を足す）

**Interfaces:**
- Consumes: `phonePhysical`, `PhonePhysical`（Task 1）、`DeviceLayout.phoneCell`（Task 2）
- Produces:
  - `EditorCanvas` の props に `phoneCell?: number | null` と `onPhonePhysical?(p: PhonePhysical): void` を足す
  - シートを包む View（今 `position: 'absolute'` のもの）に `testID="editor-sheet"`

- [ ] **Step 1: 失敗する E2E を書く**（`e2e/m3-editor.cjs` と同じ形：`npx serve dist` → 白紙 13（ダイアログに `'1'`）で作る。ポート 8097）
  - `?phone=1&ppi=96`、画面 390×844：`editor-sheet` の幅が `13 * 5 / 25.4 * 96`（≈ 245.7）±1、`phone-physical-notice` がない。シートの (0,0) のマスの中心（シートの左上 + 0.5 × 18.9）をタップして、色 5005 を塗ると `editor-stats` が `1ビーズ` を含む
  - `?phone=1&ppi=` を `Math.floor(393 / (13 * 5 / 25.4))`（= 153）、画面 393×852：`phone-physical-notice` がない（余白をなくした箱で判定している）
  - `?phone=1&ppi=400`：`phone-physical-notice` の文が `この iPhone は画面が小さいため、実寸では表示できません`
  - `?phone=1&ppi=96` で 21 の作品：`phone-physical-notice` がない、シートは箱いっぱい（今までどおり）
- [ ] **Step 2:** `npm run web:export && NODE_PATH=$(npm root -g) node e2e/m6-phone-physical.cjs` → FAIL
- [ ] **Step 3: `EditorCanvas` を変える**
  - `phonePhysical({ phoneCell, sheetW, sheetH, boxW: box.w, boxH: box.h })` を毎回求め、変わったら `onPhonePhysical` で知らせる（`useEffect` で値が変わったときだけ）
  - `'exact'` のとき：`layout = { cell: phoneCell, width: phoneCell * 13, height: phoneCell * 13 }`、`SheetCanvas` に `exactCell={phoneCell}`、ズームしない
  - ズーム：`createTouchTracker(CAN_ZOOM && p !== 'exact')`。この値が変わったら tracker を作り直し、`setZoom(IDENTITY)` する
  - プレート表示（iPad）の分岐は変えない
- [ ] **Step 4: 編集画面を変える**
  - `phoneOn = !dev.isPad && !!dev.phoneCell && view?.sheet.width === 13 && view?.sheet.height === 13`
  - `phoneOn` のとき、シートの箱（`styles.canvas` の View）に `marginHorizontal: -12, borderRadius: 0` を足す（画面の左右の余白 12pt を打ち消す）
  - `EditorCanvas` に `phoneCell={phoneOn ? dev.phoneCell : null}` と `onPhonePhysical={setPhonePhysical}` を渡す（`useState<PhonePhysical>('off')`）
  - `phonePhysical === 'too-small'` のとき、`stats` の下に `<Text testID="phone-physical-notice">`（文は Global Constraints のもの）を出す
- [ ] **Step 5:** Step 2 のコマンド → PASS。`m3-editor.cjs` も PASS（13 の作品で今までの表示のまま）
- [ ] **Step 6:** コミット `feat: iPhone の編集で 13ビーズを実寸表示する`

### Task 4: ナビ画面

**Files:**
- Modify: `src/ui/PlateStage.tsx`
- Modify: `src/app/nav/[id].tsx`
- Modify: `e2e/m6-phone-physical.cjs`

**Interfaces:**
- Consumes: Task 1・2 と同じ
- Produces: `PlateStage` の props に `onPhonePhysical?(p: PhonePhysical): void`。`SheetCanvas` に `testID="nav-sheet"`

- [ ] **Step 1: E2E を足す**（Task 3 で作った作品のまま「ナビ」へ）
  - `?phone=1&ppi=96`：`nav-sheet` の幅 ≈ 245.7 ±1、`phone-physical-notice` がない
  - `?phone=1&ppi=400`：`phone-physical-notice` が出る
- [ ] **Step 2:** 実行 → FAIL
- [ ] **Step 3: `PlateStage` を変える**
  - `phoneCell = dev.isPad ? null : dev.phoneCell` で `phonePhysical` を求め、変わったら `onPhonePhysical` で知らせる
  - `'exact'` のとき：29×29 のプレートではなく作品（13×13）をそのまま `exactCell={phoneCell}` で描く。`onFit` は `{ fits: 'full', rows: 29 }` のまま
  - `'too-small'` と `'off'` のとき：今までどおり
- [ ] **Step 4: ナビ画面を変える**
  - 13×13 の作品で `!dev.isPad && dev.phoneCell` のとき、`stage` の View に `marginHorizontal: -12` を足す
  - `'too-small'` のとき、パネルの上の行（`styles.top`）の下に `<Text testID="phone-physical-notice">` を出す（文は同じ）
- [ ] **Step 5:** 実行 → PASS。`m4-nav.cjs` も PASS
- [ ] **Step 6:** コミット `feat: iPhone のナビで 13ビーズを実寸表示する`

### Task 5: 文・仕様書・実機の確認リスト

**Files:**
- Modify: `src/app/settings.tsx`（`iPad でのみ使います（iPhone は実寸表示をしません）。` → `iPhone は、13ビーズの作品だけ実寸で表示します（機種から大きさを決めるので、ここでの調整はいりません）。`）
- Modify: `docs/superpowers/specs/2026-11-11-digital-iron-beads-design.md:264`（`iPhone では実寸表示は行わない（ズーム可能な通常の表示）` → `iPhone では 13ビーズの作品だけ、編集とナビで実寸表示する（入らない機種は注意書きを出して通常の表示）。詳しくは 2026-11-26-iphone-physical-13-design.md`）
- Create: `docs/checklists/iphone-physical-13-device.md`（`m4-device.md` の形で：iPhone 15 以降で 13 の作品のシートの幅を定規で測り 65mm ±1mm／実寸のときピンチで拡大しない／塗ったマスがタップした位置と合う／ナビでも 65mm／iPhone 12〜14・SE・mini で注意書きが出て、今までどおり拡大できる／21 以上の作品は今までどおり）

- [ ] **Step 1:** 上の3つを書く
- [ ] **Step 2:** `npx tsc --noEmit && npx expo lint && npx jest && npm run e2e:web` → すべて PASS
- [ ] **Step 3:** コミット `docs: iPhone の実寸表示の文・仕様書・確認リスト`
