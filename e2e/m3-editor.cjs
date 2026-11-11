/**
 * M3 の Web E2E：白紙 13 → ペン・ドラッグ・バケツ・Undo/Redo・選択削除・縁取り・左右反転 → 再読み込み後に保存内容を確認。
 */
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 8096;
const BASE = `http://localhost:${PORT}`;
const PHONE = { width: 390, height: 844 };
const PAD = { width: 820, height: 1180 };
const N = 13;
const RED = 3; // 5005
const YELLOW = 2; // 5003
const BLACK = 8; // 5018
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

(async () => {
  const server = spawn('npx', ['serve', 'dist', '-s', '-l', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let answer = '1';
  page.on('dialog', (d) => d.accept(answer));
  const cellPos = async (x, y) => {
    const box = await page.getByTestId('editor-canvas').boundingBox();
    const cell = Math.floor(Math.min(box.width, box.height) / N);
    const ox = box.x + (box.width - cell * N) / 2;
    const oy = box.y + (box.height - cell * N) / 2;
    return [ox + (x + 0.5) * cell, oy + (y + 0.5) * cell];
  };
  const tap = async (x, y) => page.mouse.click(...(await cellPos(x, y)));
  const stats = () => page.getByTestId('editor-stats').textContent();
  const noScroll = async (label) => {
    for (const vp of [PHONE, PAD]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(400);
      const [sh, ih] = await page.evaluate(() => [document.scrollingElement.scrollHeight, window.innerHeight]);
      check(`no scroll: ${label} @${vp.width}x${vp.height}`, sh <= ih, `${sh} <= ${ih}`);
    }
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(300);
  };
  try {
    await page.goto(BASE);
    await page.getByTestId('new-project').click();
    answer = '1'; // 13 × 13
    await page.getByTestId('source-blank').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    await noScroll('editor');

    await page.getByTestId('color-5005').click();
    await tap(0, 0);
    await page.mouse.move(...(await cellPos(0, 2)));
    await page.mouse.down();
    await page.mouse.move(...(await cellPos(4, 2)), { steps: 1 }); // 1回で飛ばす → 補間されるはず
    await page.mouse.up();
    check('pen tap + drag (interpolated)', /1色 ・ 6粒/.test(await stats()), await stats());

    await page.getByTestId('tool-bucket').click();
    await page.getByTestId('color-5003').click();
    await tap(10, 10);
    check('bucket fills background', /2色 ・ 169粒/.test(await stats()), await stats());
    await page.getByTestId('undo').click();
    check('undo bucket', /1色 ・ 6粒/.test(await stats()), await stats());
    await page.getByTestId('redo').click();
    check('redo bucket', /2色 ・ 169粒/.test(await stats()), await stats());

    await page.getByTestId('tool-select').click();
    await tap(0, 0);
    check('select one cell', (await page.getByTestId('selection-count').textContent()) === '1マス');
    await page.getByTestId('sel-delete').click();
    check('delete selection', /2色 ・ 168粒/.test(await stats()), await stats());

    await page.getByTestId('color-5018').click();
    answer = '1'; // 太さ 1
    await page.getByTestId('tool-outline').click();
    await page.waitForTimeout(200);
    check('outline fills the deleted border cell', /3色 ・ 169粒/.test(await stats()), await stats());

    answer = '1'; // 左右反転 オン
    await page.getByTestId('view-menu').click();
    await page.waitForTimeout(200);
    check('mirror on', /反転中/.test(await stats()), await stats());
    await page.getByTestId('tool-pen').click();
    await page.getByTestId('color-5005').click();
    await tap(0, 0); // 見た目の左上 = データの (12,0)

    answer = '2'; // 完成イメージ オン
    await page.getByTestId('view-menu').click();
    await page.waitForTimeout(300);
    check('melted preview on', /完成イメージ/.test(await stats()), await stats());
    await noScroll('editor melted');

    await page.waitForTimeout(800); // 自動保存
    await page.reload();
    await page.waitForTimeout(1500);
    const cells = await page.evaluate(() => {
      const k = Object.keys(localStorage).find((x) => x.startsWith('dib:project:'));
      const p = JSON.parse(localStorage.getItem(k));
      return Array.from(atob(p.sheet.cells), (ch) => ch.charCodeAt(0));
    });
    const expected = new Array(N * N).fill(YELLOW);
    expected[0] = BLACK;
    for (let x = 0; x <= 4; x++) expected[2 * N + x] = RED;
    expected[12] = RED;
    const diff = cells.map((v, i) => (v === expected[i] ? null : `${i}:${v}≠${expected[i]}`)).filter(Boolean);
    check('saved cells match after reload', diff.length === 0, diff.slice(0, 5).join(' '));
  } catch (e) {
    check('flow completed without exception', false, e.message);
    await page.screenshot({ path: `${__dirname}/failure-m3.png` });
  } finally {
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
