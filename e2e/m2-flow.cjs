/**
 * M2 の Web E2E（npm run e2e:web）。dist/ を配信し、ホーム → 写真 → 下ごしらえ → ビーズ化 → 作品画面、
 * 再読み込み後の一覧と再開、各画面がスクロールしないことを確認する。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const PORT = 8099;
const BASE = `http://localhost:${PORT}`;
const FACE = path.join(__dirname, 'fixtures', 'face.png');
const PHONE = { width: 390, height: 844 };
const PAD = { width: 820, height: 1180 };
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

async function noScroll(page, label) {
  for (const vp of [PHONE, PAD]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    const [sh, ih] = await page.evaluate(() => [document.scrollingElement.scrollHeight, window.innerHeight]);
    check(`no scroll: ${label} @${vp.width}x${vp.height}`, sh <= ih, `${sh} <= ${ih}`);
  }
  await page.setViewportSize(PHONE);
}

// 「写真から作る」のメニュー（Web では prompt）で選ぶ番号。'1' = 写真ライブラリ、'2' = ファイル
let menuAnswer = '1';
const alerts = [];

/** 画像切り出し：作品名を入れて「シート作成」 */
async function nameAndNext(page, name) {
  await page.getByTestId('prepare-name').fill(name);
  await page.getByTestId('prepare-next').click();
}

async function createFromPhoto(page, file = FACE) {
  await page.getByTestId('new-project').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('source-photo').click();
  await (await chooser).setFiles(file);
  await page.getByText('画像切り出し').waitFor({ timeout: 20000 });
}

(async () => {
  const server = spawn('npx', ['serve', 'dist', '-s', '-l', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => {
    if (d.type() === 'prompt') return d.accept(menuAnswer);
    alerts.push(d.message());
    return d.accept();
  });
  try {
    await page.goto(BASE);
    // 起動するとタイトル画面が出て、少しすると消える
    await page.getByTestId('title-screen').waitFor({ timeout: 30000 });
    check('title: shown at start', true);
    await page.getByTestId('title-screen').waitFor({ state: 'detached', timeout: 5000 });
    check('title: closes by itself', true);
    // タップでもすぐ閉じる
    await page.reload();
    await page.getByTestId('title-screen').waitFor({ timeout: 30000 });
    await page.getByTestId('title-screen').click();
    await page.getByTestId('title-screen').waitFor({ state: 'detached', timeout: 1500 });
    check('title: a tap closes it right away', true);
    await page.getByText('まだ作品がありません').waitFor({ timeout: 30000 });
    check('home shows empty state', true);
    await noScroll(page, 'home');

    await createFromPhoto(page);
    check('photo → prepare', true);
    await noScroll(page, 'prepare');

    // 作品名を決めないと「シート作成」に進めない
    check('crop: the name starts empty', (await page.getByTestId('prepare-name').inputValue()) === '');
    await page.getByTestId('prepare-next').click();
    await page.waitForTimeout(400);
    check('crop: without a name it asks for one', alerts.some((m) => m.includes('作品名を決めてください')), alerts.join(' | '));
    check('crop: and stays on the crop screen', await page.getByText('画像切り出し').isVisible());
    await nameAndNext(page, '作品A');
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    check('convert preview rendered', true);
    await noScroll(page, 'convert');
    await page.getByTestId('size-13').click();
    await page.waitForFunction(() => /元の色で表示中/.test(document.querySelector('[data-testid="convert-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    check('beads: default is the original colors', true);
    await page.getByTestId('bead-main-32').click();
    await page.waitForFunction(() => /使用 \d+色/.test(document.querySelector('[data-testid="convert-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    const stats = await page.getByTestId('convert-stats').textContent();
    check('convert stats shown after size 13 with 32 colors', /使用 \d+色 ・ \d+ビーズ/.test(stats ?? ''), stats ?? '');
    check('no color-limit slider anymore', (await page.getByTestId('max-colors').count()) === 0);

    // 元の色のまま「完了」→ どのビーズで作るかを聞く（2 = 32色）
    await page.getByTestId('bead-main-original').click();
    await page.waitForTimeout(500);
    menuAnswer = '2';
    await page.getByTestId('convert-done').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => /\d+色 ・ \d+ビーズ/.test(document.querySelector('[data-testid="editor-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    check('done → editor with bead counts', true);
    await noScroll(page, 'editor');

    await page.goto(BASE);
    await page.locator('[data-testid^="project-card-"]').first().waitFor({ timeout: 30000 });
    check('after reload home has 1 card', (await page.locator('[data-testid^="project-card-"]').count()) === 1);

    await createFromPhoto(page);
    await nameAndNext(page, '作品B');
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    await page.getByTestId('size-21').click();
    await page.waitForTimeout(1200); // 自動保存（500ms）を待つ
    await page.goto(BASE);
    const cards = page.locator('[data-testid^="project-card-"]');
    await cards.nth(1).waitFor({ timeout: 30000 });
    check('reload mid-setup keeps 2 cards', (await cards.count()) === 2);
    await page.getByText('作成中', { exact: false }).first().click();
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    const selected = await page.getByTestId('size-21').getAttribute('aria-selected');
    check('resume returns to convert screen with saved size', selected === 'true', `aria-selected=${selected}`);

    // ファイルから選ぶ：画像でないファイルは案内を出して何も作らない
    menuAnswer = '2';
    const notImage = path.join(__dirname, 'not-image.txt');
    fs.writeFileSync(notImage, 'hello');
    await page.goto(BASE);
    await page.getByTestId('new-project').click();
    let chooser = page.waitForEvent('filechooser');
    await page.getByTestId('source-photo').click();
    await (await chooser).setFiles(notImage);
    await page.waitForTimeout(1500);
    fs.unlinkSync(notImage);
    check('file: non-image shows message', alerts.some((m) => m.includes('画像を読み込めませんでした')), alerts.join(' | '));
    check('file: non-image stays on source screen', await page.getByTestId('source-photo').isVisible());

    // ファイルから選ぶ：画像なら下ごしらえへ
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('source-photo').click();
    await (await chooser).setFiles(FACE);
    await page.getByText('画像切り出し').waitFor({ timeout: 20000 });
    check('file: image → prepare', true);

    // 画像切り出しで作品名を決める（最初は空）
    const nameInput = page.getByTestId('prepare-name');
    check('name: starts empty on the crop screen', (await nameInput.inputValue()) === '', await nameInput.inputValue());
    await nameInput.fill('ねこの顔');
    await page.waitForTimeout(1200); // 自動保存（500ms）を待つ
    await page.goto(BASE);
    await page.getByText('ねこの顔').first().waitFor({ timeout: 20000 });
    check('name: renamed in prepare shows on home', true);

    // 使うビーズ：「…」→ 手持ち（64色・最初は未選択）
    menuAnswer = '1';
    await page.goto(BASE);
    await createFromPhoto(page);
    await nameAndNext(page, '作品C');
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    await page.getByTestId('beads-more').click();
    await page.getByTestId('bead-set-owned').click();
    const ownedCount = () => page.getByTestId('bead-set-count').textContent();
    check('owned: starts with nothing chosen', (await ownedCount()) === '手持ち 0色を選択中', await ownedCount());
    check('owned: opens as a full sheet (no bead preview behind it)', await page.getByTestId('owned-grid').isVisible());
    await page.getByTestId('owned-add-8').click();
    check('owned: quick add 8', (await ownedCount()) === '手持ち 8色を選択中', await ownedCount());
    const center = async (code) => {
      await page.getByTestId(`owned-${code}`).scrollIntoViewIfNeeded();
      const bb = await page.getByTestId(`owned-${code}`).boundingBox();
      return [bb.x + bb.width / 2, bb.y + bb.height / 2];
    };
    const tapChip = async (code) => {
      await page.mouse.click(...(await center(code)));
      await page.waitForTimeout(150);
    };
    const label = await page.getByTestId('owned-5005').textContent();
    check('owned: chip shows the color name before the code', label === 'あか5005', label);
    await tapChip('80-15269K'); // レモン（64色にだけある）
    check('owned: tap adds a 64-color bead', (await ownedCount()) === '手持ち 9色を選択中', await ownedCount());
    // 横になぞる：33〜36番（パステルきいろ・さんごいろ・つつじいろ・ラズベリー）が同じ段に並ぶ
    await center('5056');
    const [ax, ay] = await center('5056');
    const [bx] = await center('5088');
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(bx, ay, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    check('owned: horizontal drag selects every bead crossed', (await ownedCount()) === '手持ち 13色を選択中', await ownedCount());
    await tapChip('80-15269K');
    check('owned: tap again removes', (await ownedCount()) === '手持ち 12色を選択中', await ownedCount());
    await page.getByTestId('owned-search').fill('あか');
    const op = await page.getByTestId('owned-5001').evaluate((el) => getComputedStyle(el.firstElementChild).opacity);
    check('owned: search dims other beads', Number(op) < 0.5, op);
    await page.getByTestId('owned-search').fill('');
    await page.waitForFunction(() => !document.querySelector('[data-testid="owned-add-recommended"]')?.textContent?.includes('（0）'), null, { timeout: 20000 });
    check('owned: recommended colors are computed', true);
    await page.getByTestId('bead-set-close').click();
    await page.waitForTimeout(500);
    check('owned: the more button shows the owned count', ((await page.getByTestId('beads-more').textContent()) ?? '').includes('手持ち12'), await page.getByTestId('beads-more').textContent());
    await page.waitForFunction(() => /使用 \d+色/.test(document.querySelector('[data-testid="convert-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    check('owned: preview uses the owned beads', true);
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByTestId('beads-more').click();
    await page.getByTestId('bead-set-owned').click();
    check('owned: remembered after reload (shared by all works)', (await ownedCount()) === '手持ち 12色を選択中', await ownedCount());
    await page.getByTestId('bead-set-8').click();
    check('owned: 8 colors set', (await page.getByTestId('bead-set-count').textContent()) === '8色');
    await page.getByTestId('bead-set-close').click();

    // 切り抜いて作った作品：.beads には切り抜いた後の画像だけが入る／編集からビーズシートを作り直せる
    await page.goto(BASE);
    await createFromPhoto(page);
    const tl = await page.getByTestId('crop-tl').boundingBox();
    await page.mouse.move(tl.x + tl.width / 2, tl.y + tl.height / 2);
    await page.mouse.down();
    await page.mouse.move(tl.x + tl.width / 2 + 80, tl.y + tl.height / 2 + 80, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await nameAndNext(page, '切り抜き');
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    await page.getByTestId('size-13').click();
    await page.waitForTimeout(800);
    menuAnswer = '1'; // 16色
    await page.getByTestId('convert-done').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    menuAnswer = '4'; // メニュー → 書き出し・共有
    await page.getByTestId('view-menu').click();
    await page.getByTestId('export-beads').waitFor({ timeout: 30000 });
    check('export: no mirror switch, no text sharing', (await page.getByTestId('export-text').count()) === 0 && (await page.getByText('左右反転して書き出す').count()) === 0);
    check('export: the name is editable at the top', (await page.getByTestId('export-name').inputValue()) === '切り抜き');
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-beads').click();
    const beadsPath = path.join(require('node:os').tmpdir(), 'crop-test.beads');
    await (await dl).saveAs(beadsPath);
    const { unzipSync, strFromU8 } = require(path.join(__dirname, '..', 'node_modules', 'fflate'));
    const files = unzipSync(new Uint8Array(fs.readFileSync(beadsPath)));
    const pj = JSON.parse(strFromU8(files['project.json']));
    const png = files['source.png'];
    const pw = png ? (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19] : 0;
    check('.beads: the crop is baked into the image', pj.source && pj.source.crop === undefined && pw > 0 && pw < 600, `crop=${JSON.stringify(pj.source?.crop)} width=${pw}`);
    // 書き出しで名前を変える → 編集画面にも反映
    await page.getByTestId('export-name').fill('切り抜きの顔');
    const dl2 = page.waitForEvent('download');
    await page.getByTestId('export-png').click();
    const pngPath = path.join(require('node:os').tmpdir(), 'crop-test.png');
    await (await dl2).saveAs(pngPath);
    const pb = fs.readFileSync(pngPath);
    const [w, h] = [pb.readUInt32BE(16), pb.readUInt32BE(20)];
    check('export: PNG has the sheet and the bead list below it', w >= 13 * 24 && h > 13 * 24 + 32 * 2 + 26 + 36, `${w}x${h}`);
    await page.getByText('‹ 戻る').last().click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    check('export: the new name shows in the editor', await page.getByText('切り抜きの顔').first().isVisible());
    // メニュー → ビーズシートを作り直す（確認 OK）→ サイズを変えて「編集」→ 同じ作品の編集画面に戻る
    const statsBefore = await page.getByTestId('editor-stats').textContent();
    menuAnswer = '5';
    await page.getByTestId('view-menu').click();
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    check('remake: opens the bead-sheet screen', await page.getByText('ビーズシート作成').isVisible());
    await page.getByTestId('size-21').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('convert-done').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    check('remake: back in the same work', await page.getByText('切り抜きの顔').first().isVisible());
    const statsAfter = await page.getByTestId('editor-stats').textContent();
    check('remake: the editor shows the new sheet (13 → 21)', statsAfter !== statsBefore, `${statsBefore} → ${statsAfter}`);
    await page.goto(BASE);
    await page.getByText('切り抜きの顔').first().waitFor({ timeout: 20000 });
    check('remake: still one work (overwritten, not copied)', (await page.getByText('切り抜きの顔').count()) === 1);
  } catch (e) {
    check('flow completed without exception', false, e.message);
    await page.screenshot({ path: path.join(__dirname, 'failure.png') });
  } finally {
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
