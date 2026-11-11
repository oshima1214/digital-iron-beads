/**
 * M2 の Web E2E（npm run e2e:web）。dist/ を配信し、ホーム → 写真 → 下ごしらえ → ビーズ化 → 作品画面、
 * 再読み込み後の一覧と再開、各画面がスクロールしないことを確認する。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
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

async function createFromPhoto(page) {
  await page.getByTestId('new-project').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('source-photo').click();
  await (await chooser).setFiles(FACE);
  await page.getByText('下ごしらえ').waitFor({ timeout: 20000 });
}

(async () => {
  const server = spawn('npx', ['serve', 'dist', '-s', '-l', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(BASE);
    await page.getByText('まだ作品がありません').waitFor({ timeout: 30000 });
    check('home shows empty state', true);
    await noScroll(page, 'home');

    await createFromPhoto(page);
    check('photo → prepare', true);
    await noScroll(page, 'prepare');

    await page.getByTestId('prepare-next').click();
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    check('convert preview rendered', true);
    await noScroll(page, 'convert');
    await page.getByTestId('size-13').click();
    await page.waitForFunction(() => /使用 \d+色/.test(document.querySelector('[data-testid="convert-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    const stats = await page.getByTestId('convert-stats').textContent();
    check('convert stats shown after size 13', /使用 \d+色 ・ \d+粒/.test(stats ?? ''), stats ?? '');

    await page.getByTestId('convert-done').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => /\d+色 ・ \d+粒/.test(document.querySelector('[data-testid="editor-stats"]')?.textContent ?? ''), null, { timeout: 30000 });
    check('done → editor with bead counts', true);
    await noScroll(page, 'editor');

    await page.goto(BASE);
    await page.locator('[data-testid^="project-card-"]').first().waitFor({ timeout: 30000 });
    check('after reload home has 1 card', (await page.locator('[data-testid^="project-card-"]').count()) === 1);

    await createFromPhoto(page);
    await page.getByTestId('prepare-next').click();
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
