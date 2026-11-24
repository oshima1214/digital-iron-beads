# 状態機械の一覧

このアプリの「今どの場面か」を決めている仕組みの一覧です。
状態を足す・変えるときは、まずここを見て、同じ場所に足してください。

## 決まり

1. **場面は名前のある型で表す。** `boolean` をいくつも組み合わせて場面を表さない（`anchor && !pendingSecond` のような条件を画面に書かない）。
2. **進み方は純粋な関数に書く。** `src/core/machines/` に置き、React にも保存にも触らない。テストは同じフォルダに置く。
3. **ストアは状態機械を1歩進めて、結果を画面に見せるだけ。** 画面は `phase` や `status` の名前で出し分ける。
4. **ほかの値から決まるものは保存しない。** 関数で求める（`loadStatus`、`navPhase`、`editorMode`）。

## 明示している状態機械

| 名前 | 場所 | 状態 | 使っている画面 |
|---|---|---|---|
| 範囲選択 | `src/core/machines/rangeSelect.ts` | `idle` → `dragging` → `idle`（確定）／`dragging` → `anchored` → `closing` → `idle`（確定） | 編集（`editor.ts` の `rangePhase` / `range`） |
| 読み込み | `src/core/machines/loadStatus.ts` | `loading` → `ready` / `error` | 下ごしらえ・ビーズ化（`useDraftFor`）、編集、制作ナビ、書き出し |
| ナビの進み具合 | `src/core/machines/phases.ts` `navPhase` | `empty` / `placing` ⇄ `done` | 制作ナビ |
| 編集でできる操作 | `src/core/machines/phases.ts` `editorMode` | `viewing` / `brush` / `bucket` / `select` | 編集（パネルの上の段、ツールバー） |
| 作品の段階 | `Project.stage` と `phases.ts` `screenForStage` | `setup` →「編集」→ `edit`。`edit` の作品も、元の写真があればメニュー「ビーズシートを作り直す」で作成画面に戻れる（`edit` のまま、「編集」でシートを置き換える） | ホーム（開く画面を決める）、編集のメニュー |
| 手持ちをタップ・なぞって選ぶ | `src/core/machines/dragSelect.ts` | `idle` ──press──▶ `pending` ──横に動く──▶ `painting(add / remove)`（最初のビーズで向きが決まる）／縦に動く──▶ `scrolling`／release──▶ タップとして切り替え。`allowsScroll` で、横になぞる間だけスクロールを止める | ビーズ化の「…」→ 手持ち（`src/ui/beads/BeadSetSheet.tsx`） |
| ビーズ化のプレビュー | `src/state/draft.ts` の `ConvertPreview` と `beadsNeeded` | `original`（元の色）/ `beads` / `no-beads`（手持ちが0色）。`beadsNeeded` が `ready` でないと「完了」の前にビーズを聞く | ビーズ化 |
| 使うビーズ | `src/core/palette/types.ts` の `BeadSet` | `original` / `8` / `16` / `32` / `owned` | ビーズ化 |
| タッチの解釈 | `src/ui/editor/touchTracker.ts` | `idle` / `pending` / `tool` / `pinch` / `ignore` | 編集のシート |
| 色えらびの対象 | `convert.tsx` / `text.tsx` の `picker` | `null` / `'set'` `'dark'` `'light'` / `'fg'` `'bg'` | ビーズ化、文字から作る |

### 範囲選択の図

```
idle ──press──▶ dragging ──release（動かした）──▶ idle ＋ 選択に追加
                   │
                   └─release（同じマス）──▶ anchored ──press──▶ closing ──release──▶ idle ＋ 選択に追加
どの状態でも：道具の切り替え・範囲スイッチ・解除・作品を閉じる ──▶ idle
```

`anchored` のあいだは、編集画面の上の行に「範囲：もう一方の角をタップ」と出る。

## あえて今のままにしているもの

| もの | 場所 | 今の形 | そのままにした理由 |
|---|---|---|---|
| 自動保存 | `src/core/util/autosave.ts` | `value` / `timer` / `inflight` / `lastError` の組み合わせ（待ちなし・予約中・保存中・失敗して再試行待ち） | 1つの関数に閉じていて、順序のテストがある。作り直す危険のほうが大きい |
| なぞり中 | `editor.ts` の `stroke` | `null` か「なぞり中」の2つ | 2つしかなく、`null` で十分に表せている |
| 処理中 | `new/index.tsx`・`export/[id].tsx` の `busy`、`convert.tsx` の `converting`、`draft.ts` の `busy` | `boolean` | 「待ち」と「処理中」の2つだけ |
| 起動 | `src/app/_layout.tsx` | フォント × Skia の読み込み → `ready` | 起動のときに1回通るだけ |
| 操作の結果の一言 | `editor.ts` の `notice` | `null` / `'same-color'`（バケツで同じ色をタップした） | 次の操作（色・道具を選ぶ、バケツ）で消えるだけ。理由が増えたら union に足す |
| タイトル画面 | `src/app/_layout.tsx` の `title` | `showing` →（約2.6秒たつ・タップ・薄くなって消える）→ `done` | 起動したときだけ。2つしかない |
| 受け取ったファイル | `src/state/incoming.ts` | `pending`（あり / なし） | 2つだけ |
| 元に戻す | `src/core/history/history.ts` | 積んだ差分と位置 | すでに1つのクラスに閉じている |
| ピンチ・切り抜き枠のドラッグ | `EditorCanvas.tsx`・`CropBox.tsx` の ref | ジェスチャー中だけの値 | 描画のたびに作り直さないための入れ物で、場面の判断には使っていない |

## これからの候補

- **自動保存の失敗を画面に出す。** 今は保存に失敗しても、編集画面では何も表示されない（ビーズ化の「完了」だけ案内が出る）。`autosave.ts` に `status` を足せば出せる。
- **読み込みの失敗からのやり直し。** `error` になると、ホームに戻るまで同じ画面では読み直さない。
