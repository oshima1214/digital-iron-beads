/**
 * 元のアルゴリズム（V7）と新方式を並べた HTML を出力する。
 * 実行: npm run compare -- [--dir tools/compare/fixtures] [--size 29]
 */
import fs from 'node:fs';
import path from 'node:path';

import { convertImage } from '../../src/core/convert/convert';
import { defaultConvertSettings, type RgbaImage } from '../../src/core/convert/types';
import { countBeads } from '../../src/core/sheet/counts';
import type { Sheet, SheetSize } from '../../src/core/sheet/sheet';
import { encodePng, readImage } from './image-io';
import { legacyConvert, resizeArea } from './legacy';
import { renderSheet } from './render';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const dir = arg('dir', path.join(__dirname, 'fixtures'));
const size = Number(arg('size', '29')) as SheetSize;
const lineOverride = process.argv.includes('--line') ? Number(arg('line', '0.25')) : undefined;
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

const uri = (img: RgbaImage) => `data:image/png;base64,${encodePng(img).toString('base64')}`;
const stats = (s: Sheet) => {
  const c = countBeads(s);
  return `${c.length}色 / ${c.reduce((a, b) => a + b.count, 0)}粒`;
};

const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
const rows: string[] = [];
for (const f of files) {
  const img = readImage(path.join(dir, f));
  const thumbScale = 348 / Math.max(img.width, img.height);
  const thumb = resizeArea(img, Math.round(img.width * thumbScale), Math.round(img.height * thumbScale));
  const t0 = Date.now();
  const legacy = legacyConvert(img, size, 32);
  const t1 = Date.now();
  const settings = defaultConvertSettings(size);
  if (lineOverride !== undefined) settings.lineThreshold = lineOverride;
  const next = convertImage(img, settings);
  const t2 = Date.now();
  const cellPx = Math.max(3, Math.floor(348 / size));
  rows.push(`<tr><th>${f}</th>
<td><img src="${uri(thumb)}" class="thumb"><div>元画像 ${img.width}×${img.height}</div></td>
<td><img src="${uri(renderSheet(legacy, cellPx))}"><div>V7: ${stats(legacy)} (${t1 - t0}ms)</div></td>
<td><img src="${uri(renderSheet(next, cellPx))}"><div>新方式: ${stats(next)} (${t2 - t1}ms)</div></td></tr>`);
  console.log(`${f}: legacy ${stats(legacy)}, new ${stats(next)}`);
}

const html = `<!doctype html><meta charset="utf-8"><title>変換比較 ${size}マス</title>
<style>body{font-family:-apple-system,'Hiragino Sans',sans-serif;background:#f2f2f7;margin:24px}table{border-collapse:separate;border-spacing:12px}
td{background:#fff;border-radius:12px;padding:12px;vertical-align:top;text-align:center;font-size:13px;color:#333}th{text-align:left;font-size:13px}
img{display:block;margin:0 auto 6px;image-rendering:pixelated}.thumb{background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}</style>
<h1>変換比較（${size}×${size}、32色、新方式は初期設定 illust${lineOverride !== undefined ? `、線の割合 ${lineOverride}` : ''}）</h1>
<table><tr><th></th><th>元画像</th><th>V7（平均＋RGB距離）</th><th>新方式（案1）</th></tr>${rows.join('\n')}</table>`;
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`wrote ${path.join(outDir, 'index.html')}`);
