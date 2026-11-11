/**
 * M5 の Web E2E：文字から作る、書き出し（.beads・印刷）、読み込み（正常・壊れたファイル）、
 * 58 マスで反転中のプレート選択、スクロールしないこと。
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const PORT = 8090;
const BASE = `http://localhost:${PORT}`;
const PHONE = { width: 390, height: 844 };
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}
async function noScroll(page, label) {
  const [sh, ih] = await page.evaluate(() => [document.scrollingElement.scrollHeight, window.innerHeight]);
  check(`no scroll: ${label}`, sh <= ih, `${sh} <= ${ih}`);
}

(async () => {
  const server = spawn('npx', ['serve', 'dist', '-s', '-l', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: PHONE, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let answer = '1';
  const alerts = [];
  page.on('dialog', (d) => {
    if (d.type() === 'alert') alerts.push(d.message());
    d.accept(answer);
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dib-e2e-'));
  const cards = () => page.locator('[data-testid^="project-card-"]').count();
  try {
    // 1. 文字から作る
    await page.goto(BASE);
    await page.getByTestId('new-project').click();
    await page.getByTestId('source-text').click();
    await page.getByTestId('text-input').waitFor({ timeout: 30000 });
    await noScroll(page, 'text');
    await page.getByTestId('text-input').fill('あいう');
    check('3 full-width chars are rejected on 29', (await page.getByTestId('text-input').inputValue()) !== 'あいう');
    await page.getByTestId('text-input').fill('AB');
    await page.getByTestId('text-preview').waitFor({ timeout: 15000 });
    await page.getByTestId('text-create').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    const stats = await page.getByTestId('editor-stats').textContent();
    check('text "AB" becomes a 1-colour sheet with beads', /^1色 ・ [1-9]\d*粒/.test(stats), stats);

    // 2. 書き出し：.beads と印刷
    answer = '4'; // 表示 → 書き出し・共有
    await page.getByTestId('view-menu').click();
    await page.getByTestId('export-beads').waitFor({ timeout: 30000 });
    await noScroll(page, 'export');
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-beads').click();
    const beadsPath = path.join(tmp, 'AB.beads');
    await (await dl).saveAs(beadsPath);
    check('.beads downloaded', fs.statSync(beadsPath).size > 50, `${fs.statSync(beadsPath).size} bytes`);
    const popupP = context.waitForEvent('page');
    await page.getByTestId('export-print').click();
    const popup = await popupP;
    await popup.waitForLoadState();
    const sections = await popup.locator('section.page').count();
    check('print html has plate + counts pages', sections === 2, String(sections));
    check('print svg is 145mm', (await popup.locator('svg[width="145mm"]').count()) === 1);
    await popup.close();

    // 3. 読み込み（正常）→ 作品が増える（別の id）
    await page.goto(BASE);
    await page.locator('[data-testid^="project-card-"]').first().waitFor({ timeout: 30000 });
    const before = await cards();
    let chooser = page.waitForEvent('filechooser');
    await page.getByTestId('import-file').click();
    await (await chooser).setFiles(beadsPath);
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    check('imported project opens in the editor', /^1色/.test(await page.getByTestId('editor-stats').textContent()));
    await page.goto(BASE);
    await page.locator('[data-testid^="project-card-"]').first().waitFor({ timeout: 30000 });
    check('import adds a second project (new id)', (await cards()) === before + 1, `${before} → ${await cards()}`);

    // 4. 読み込み（壊れたファイル）→ 理由が出る、作品は増えない
    const broken = path.join(tmp, 'broken.beads');
    fs.writeFileSync(broken, Buffer.from([1, 2, 3, 4, 5]));
    const n = await cards();
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('import-file').click();
    await (await chooser).setFiles(broken);
    await page.waitForTimeout(1200);
    check('broken file shows the reason', alerts.some((m) => /ファイルではありません/.test(m)), alerts.join(' | '));
    check('broken file adds nothing', (await cards()) === n);

    // 5. 58 マス（左右非対称）：右上のプレートにだけ1粒。反転中は見た目の左上にそれが出る
    await page.getByTestId('new-project').click();
    answer = '4'; // 58 × 58
    await page.getByTestId('source-blank').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    await page.getByTestId('color-5005').click();
    const box = await page.getByTestId('editor-canvas').boundingBox();
    const cell = Math.floor(Math.min(box.width, box.height) / 58 * 1000) / 1000;
    const ox = box.x + (box.width - cell * 58) / 2;
    const oy = box.y + (box.height - cell * 58) / 2;
    await page.mouse.click(ox + (45 + 0.5) * cell, oy + (5 + 0.5) * cell); // データの (45,5) = 右上のプレート
    check('one bead painted in the right-top plate', /1色 ・ 1粒/.test(await page.getByTestId('editor-stats').textContent()));
    await page.waitForTimeout(700);
    await page.getByTestId('to-nav').click();
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    await page.getByTestId('plate-1').click();
    check('not mirrored: left-top plate is empty', /ビーズがありません/.test(await page.getByTestId('nav-current').textContent()));
    await page.getByTestId('nav-mirror').click();
    await page.getByTestId('plate-1').click();
    const title = await page.getByTestId('nav-title').textContent();
    check('mirrored: visual plate 1 is titled 1/4', /プレート 1\/4/.test(title), title);
    check('mirrored: visual plate 1 shows the right-top plate bead', /5005 あか ・ 1粒/.test(await page.getByTestId('nav-current').textContent()), await page.getByTestId('nav-current').textContent());
  } catch (e) {
    check('flow completed without exception', false, e.message);
    await page.screenshot({ path: path.join(__dirname, 'failure-m5.png') });
  } finally {
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
