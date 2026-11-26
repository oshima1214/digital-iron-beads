/**
 * iPhone の実寸表示（13ビーズ）の Web E2E。?phone=1 で iPhone として、?ppi= で画面の細かさを変えて確かめる。
 */
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 8097;
const BASE = `http://localhost:${PORT}`;
const MM = 5 / 25.4; // 1マス（inch）
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

(async () => {
  const server = spawn('npx', ['serve', 'dist', '-s', '-l', String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let answer = '1';
  page.on('dialog', (d) => d.accept(answer));
  const notice = () => page.getByTestId('phone-physical-notice');
  const NOTICE = 'この iPhone は画面が小さいため、実寸では表示できません';

  // ?phone= は、その画面を URL で直接開いたときだけ効く（m4 の ?pad= と同じ。アプリの中で移動すると URL の ? 以降は消える）
  let id13 = '';
  /** 13 の作品の編集画面を query 付きで直接開く */
  const openWork = async (query, viewport) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto(`${BASE}/project/${id13}${query}`);
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
  };
  try {
    // 13 の作品を作る
    await page.goto(`${BASE}/`);
    await page.getByTestId('new-project').click();
    answer = '1';
    await page.getByTestId('source-blank').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    id13 = new URL(page.url()).pathname.split('/').pop();

    // ① 実寸（ppi=96 → 1マス 18.9px、13マス 245.7px）
    await openWork('?phone=1&ppi=96');
    const sheet = page.getByTestId('editor-sheet');
    const b = await sheet.boundingBox();
    const want = 13 * MM * 96;
    check('editor: 13 beads drawn at physical size', Math.abs(b.width - want) <= 1, `${b.width.toFixed(1)} vs ${want.toFixed(1)}`);
    check('editor: no notice when it fits', (await notice().count()) === 0);
    const cell = MM * 96;
    await page.getByTestId('color-5005').click();
    await page.mouse.click(b.x + cell * 0.5, b.y + cell * 0.5);
    check('editor: tapping the top-left cell paints one bead', /1ビーズ/.test(await page.getByTestId('editor-stats').textContent()), await page.getByTestId('editor-stats').textContent());

    // ② iPhone 15 の幅（393pt）に、余白なしでやっと入る細かさ
    const ppi15 = Math.floor(393 / (13 * MM));
    await openWork(`?phone=1&ppi=${ppi15}`, { width: 393, height: 852 });
    const w15 = (await page.getByTestId('editor-sheet').boundingBox()).width;
    check('editor: fits edge to edge on a 393pt wide screen', (await notice().count()) === 0 && Math.abs(w15 - 13 * MM * ppi15) <= 1, `${w15.toFixed(1)}`);

    // ③ 入らない
    await openWork('?phone=1&ppi=400', { width: 390, height: 844 });
    check('editor: notice when it does not fit', (await notice().count()) === 1 && (await notice().textContent()) === NOTICE);

    // ナビ（13 の作品。①で1ビーズ塗ってある）
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/nav/${id13}?phone=1&ppi=96`);
    await page.getByTestId('nav-stage').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    const nb = await page.getByTestId('nav-sheet').boundingBox();
    check('nav: 13 beads drawn at physical size', Math.abs(nb.width - want) <= 1, `${nb.width.toFixed(1)} vs ${want.toFixed(1)}`);
    check('nav: no notice when it fits', (await notice().count()) === 0);
    await page.goto(`${BASE}/nav/${id13}?phone=1&ppi=400`);
    await page.getByTestId('nav-stage').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    check('nav: notice when it does not fit', (await notice().count()) === 1 && (await notice().textContent()) === NOTICE);

    // ④ 21 の作品は対象外
    await page.goto(`${BASE}/`);
    await page.getByTestId('new-project').click();
    answer = '2';
    await page.getByTestId('source-blank').click();
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    const id21 = new URL(page.url()).pathname.split('/').pop();
    await page.goto(`${BASE}/project/${id21}?phone=1&ppi=96`);
    await page.getByTestId('editor-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    const box = await page.getByTestId('editor-canvas').boundingBox();
    const s21 = await page.getByTestId('editor-sheet').boundingBox();
    check('editor: 21 beads are not physical (no notice)', (await notice().count()) === 0);
    check('editor: 21 beads fill the box as before', s21.width >= Math.min(box.width, box.height) - 21, `${s21.width} / ${box.width}`);
  } catch (e) {
    check('flow completed without exception', false, e.message);
    await page.screenshot({ path: `${__dirname}/failure-m6.png` });
  } finally {
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
