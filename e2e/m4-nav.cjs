/**
 * M4 の Web E2E：58 マスの作品で制作ナビ（前へ・次へ・色へ移動・完成・プレート切り替え・再開）、
 * iPad 表示（?pad=1）の画面配置とタッチ無効、設定の補正係数の保存、スクロールしないこと。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const PORT = 8094;
const BASE = `http://localhost:${PORT}`;
const FACE = path.join(__dirname, 'fixtures', 'face.png');
const PHONE = { width: 390, height: 844 };
const PAD = { width: 820, height: 1180 };
const PAD_LAND = { width: 1180, height: 820 };
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
  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const current = () => page.getByTestId('nav-current').textContent();
  const title = () => page.getByTestId('nav-title').textContent();
  try {
    await page.goto(BASE);
    await page.getByTestId('new-project').click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('source-photo').click();
    await (await chooser).setFiles(FACE);
    await page.getByTestId('prepare-next').click();
    await page.getByTestId('convert-preview').waitFor({ timeout: 30000 });
    await page.getByTestId('size-58').click();
    await page.waitForTimeout(1500);
    await page.getByTestId('convert-done').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    const id = page.url().split('/').pop().split('?')[0];
    check('58 sheet created and editor opened', id.length > 5, id);

    await page.getByTestId('to-nav').click();
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    check('nav title shows plate 1/4', /プレート 1\/4/.test(await title()), await title());
    await noScroll(page, 'nav @phone');
    const first = await current();
    await page.getByTestId('nav-next').click();
    const second = await current();
    check('next changes the colour', first !== second, `${first} → ${second}`);
    await page.getByTestId('nav-prev').click();
    check('prev goes back', (await current()) === first);
    const chips = page.locator('[data-testid^="nav-chip-"]');
    const nChips = await chips.count();
    await chips.nth(nChips - 1).click();
    check('chip jumps to the last colour', new RegExp(`${nChips} / ${nChips} 色め`).test(await page.locator('text=色め').first().textContent()));
    await page.getByTestId('nav-next').click();
    check('next on the last colour → plate complete', /完成/.test(await current()), await current());

    await page.getByTestId('plate-2').click();
    check('minimap switches to plate 2/4', /プレート 2\/4/.test(await title()), await title());
    await page.waitForTimeout(900); // 自動保存
    await page.reload();
    await page.getByTestId('nav-title').waitFor({ timeout: 30000 });
    check('reload resumes nav at plate 2/4', /プレート 2\/4/.test(await title()), await title());

    // スワイプで戻る（ブラウザの「戻る」＝「‹ 編集」ボタンを通らない経路）→ 編集 → もう一度ナビ：進み具合が残る
    await page.goto(`${BASE}/project/${id}`);
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.getByTestId('to-nav').click();
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    await page.getByTestId('plate-1').click();
    await page.getByTestId('nav-next').click();
    await page.waitForTimeout(900);
    const progressBefore = await current();
    await page.goBack();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    const statsBefore = await page.getByTestId('editor-stats').textContent();
    await page.getByTestId('color-5005').click(); // 図案にない色で塗って、必ず保存が起きるようにする
    const eb = await page.getByTestId('editor-canvas').boundingBox();
    await page.mouse.click(eb.x + eb.width / 2, eb.y + eb.height / 2);
    await page.waitForTimeout(300);
    check('edit after swipe-back actually changed the sheet', (await page.getByTestId('editor-stats').textContent()) !== statsBefore);
    await page.waitForTimeout(900);
    await page.getByTestId('to-nav').click();
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    check('swipe-back then edit keeps nav progress', (await current()) === progressBefore, `${progressBefore} / ${await current()}`);

    // iPad mini 横向き（163pt/inch、1133×744）：上に薄いパネル、上半分/下半分の切り替え
    await page.setViewportSize({ width: 1133, height: 744 });
    await page.goto(`${BASE}/nav/${id}?pad=1&ppi=163`);
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    check('iPad mini landscape: no rotate message', (await page.getByText('横向きにしてください', { exact: false }).count()) === 0);
    check('iPad mini landscape: half toggle shown', (await page.getByTestId('nav-half-1').count()) === 1);
    if ((await page.getByTestId('nav-half-1').count()) === 1) {
      await page.getByTestId('nav-half-1').click();
      check('iPad mini landscape: switch to bottom half', (await page.getByTestId('nav-half-1').getAttribute('aria-selected')) === 'true');
    }
    await noScroll(page, 'nav @iPad mini landscape');
    await page.setViewportSize({ width: 744, height: 1133 });
    await page.waitForTimeout(600);
    check('iPad mini portrait: rotate message', (await page.getByText('横向きにしてください', { exact: false }).count()) === 1);

    // iPad 表示（縦向き）：パネルが上、シートが下。シートはタッチを受けない
    await page.setViewportSize(PAD);
    await page.goto(`${BASE}/nav/${id}?pad=1`);
    await page.getByTestId('nav-current').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    const panelBox = await page.getByTestId('nav-title').boundingBox();
    const stageBox = await page.getByTestId('nav-stage').boundingBox();
    check('iPad portrait: panel above the plate', panelBox.y < stageBox.y, `${panelBox.y} < ${stageBox.y}`);
    const before = await current();
    await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
    check('iPad: touching the plate changes nothing', (await current()) === before);
    await noScroll(page, 'nav @iPad portrait');

    // iPad 横向き：シートとパネルが左右（パネルは右）
    await page.setViewportSize(PAD_LAND);
    await page.waitForTimeout(600);
    const p2 = await page.getByTestId('nav-title').boundingBox();
    const s2 = await page.getByTestId('nav-stage').boundingBox();
    check('iPad landscape: panel to the right of the plate', p2.x > s2.x, `${p2.x} > ${s2.x}`);
    await noScroll(page, 'nav @iPad landscape');

    // 設定：補正係数が保存される
    await page.setViewportSize(PAD);
    await page.goto(`${BASE}/settings?pad=1`);
    await page.getByTestId('cal-value').waitFor({ timeout: 30000 });
    await page.getByTestId('cal-plus').click();
    await page.getByTestId('cal-plus').click();
    const cal = await page.getByTestId('cal-value').textContent();
    check('calibration +2 steps = 1.004', /補正 1\.004/.test(cal), cal);
    await noScroll(page, 'settings @iPad');
    await page.reload();
    await page.getByTestId('cal-value').waitFor({ timeout: 30000 });
    check('calibration persists after reload', /補正 1\.004/.test(await page.getByTestId('cal-value').textContent()));

    // iPad の編集画面：パネルが上、ミニマップあり、スクロールしない
    await page.goto(`${BASE}/project/${id}?pad=1`);
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    const tb = await page.getByTestId('tool-pen').boundingBox();
    const cb = await page.getByTestId('editor-canvas').boundingBox();
    check('iPad editor: tools above the plate', tb.y < cb.y, `${tb.y} < ${cb.y}`);
    check('iPad editor: minimap shown for 58', (await page.getByTestId('plate-4').count()) === 1);
    await noScroll(page, 'editor @iPad');
  } catch (e) {
    check('flow completed without exception', false, e.message);
    await page.screenshot({ path: path.join(__dirname, 'failure-m4.png') });
  } finally {
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
