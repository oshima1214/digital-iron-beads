/**
 * 比較用の自作合成画像を生成する（著作権のある画像は使わない）。
 * 実行: npm run fixtures
 */
import fs from 'node:fs';
import path from 'node:path';

import type { RgbaImage } from '../../../src/core/convert/types';
import { encodePng } from '../image-io';
import { resizeArea } from '../legacy';

type C = [number, number, number, number];
/** 4倍で描いて縮小し、実際のイラストのような滑らかなふち（アンチエイリアス）にする。 */
const SS = 4;
const OUT = 600;
const S = OUT * SS;

function canvas(c: C): RgbaImage {
  const data = new Uint8ClampedArray(S * S * 4);
  for (let i = 0; i < S * S; i++) data.set(c, i * 4);
  return { width: S, height: S, data };
}
function plot(img: RgbaImage, x: number, y: number, c: C) {
  if (x >= 0 && y >= 0 && x < img.width && y < img.height) img.data.set(c, (y * img.width + x) * 4);
}
function disc(img: RgbaImage, cx: number, cy: number, r: number, c: C) {
  [cx, cy, r] = [cx * SS, cy * SS, r * SS];
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) plot(img, x, y, c);
}
function ring(img: RgbaImage, cx: number, cy: number, r: number, t: number, c: C) {
  [cx, cy, r, t] = [cx * SS, cy * SS, r * SS, t * SS];
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= r && d >= r - t) plot(img, x, y, c);
    }
  }
}
function line(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, t: number, c: C) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * SS);
  for (let k = 0; k <= n; k++) disc(img, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, t / 2, c);
}

const BLACK: C = [20, 20, 20, 255];
const WHITE: C = [255, 255, 255, 255];

function face(): RgbaImage {
  const img = canvas([235, 245, 255, 255]);
  disc(img, 300, 310, 230, [255, 214, 90, 255]);
  ring(img, 300, 310, 230, 10, BLACK);
  disc(img, 220, 260, 32, BLACK);
  disc(img, 380, 260, 32, BLACK);
  disc(img, 230, 248, 10, WHITE);
  disc(img, 390, 248, 10, WHITE);
  disc(img, 170, 350, 30, [255, 150, 160, 255]);
  disc(img, 430, 350, 30, [255, 150, 160, 255]);
  for (let a = 0.15 * Math.PI; a <= 0.85 * Math.PI; a += 0.01) disc(img, 300 + Math.cos(a) * 110, 360 + Math.sin(a) * 70, 6, [200, 30, 40, 255]);
  return img;
}

function star(): RgbaImage {
  const img = canvas(WHITE);
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 110 : 260;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push([300 + Math.cos(a) * r, 310 + Math.sin(a) * r]);
  }
  for (let k = 0; k < 10; k++) line(img, ...pts[k], ...pts[(k + 1) % 10], 6, [40, 60, 160, 255]);
  return img;
}

function gradient(): RgbaImage {
  const img = canvas(WHITE);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const h = (x / S) * 6;
      const k = (n: number) => {
        const v = Math.max(0, Math.min(1, Math.abs(((h + n) % 6) - 3) - 1));
        return Math.round(255 * (1 - (y / S) * 0.6) * v + 255 * (y / S) * 0.25);
      };
      plot(img, x, y, [k(0), k(4), k(2), 255]);
    }
  }
  return img;
}

function darkOnDark(): RgbaImage {
  const img = canvas([10, 10, 10, 255]);
  disc(img, 300, 300, 200, [255, 242, 0, 255]);
  ring(img, 300, 300, 200, 12, BLACK);
  ring(img, 300, 300, 140, 12, BLACK);
  disc(img, 300, 300, 50, BLACK);
  return img;
}

function thinLines(): RgbaImage {
  const img = canvas(WHITE);
  line(img, 60, 80, 540, 80, 3, [40, 60, 160, 255]);
  line(img, 60, 160, 540, 300, 3, [221, 8, 8, 255]);
  line(img, 60, 520, 300, 220, 4, BLACK);
  line(img, 300, 220, 540, 520, 4, BLACK);
  ring(img, 300, 420, 70, 3, [53, 150, 63, 255]);
  return img;
}

function highlight(): RgbaImage {
  const img = canvas([230, 240, 250, 255]);
  disc(img, 300, 300, 260, [255, 205, 216, 255]);
  ring(img, 300, 300, 260, 8, BLACK);
  disc(img, 200, 260, 45, BLACK);
  disc(img, 400, 260, 45, BLACK);
  disc(img, 212, 246, 12, WHITE);
  disc(img, 412, 246, 12, WHITE);
  line(img, 250, 390, 350, 390, 6, BLACK);
  return img;
}

function transparent(): RgbaImage {
  const img = canvas([0, 0, 0, 0]);
  disc(img, 300, 320, 220, [255, 111, 152, 255]);
  ring(img, 300, 320, 220, 10, BLACK);
  disc(img, 210, 140, 70, [255, 111, 152, 255]);
  ring(img, 210, 140, 70, 10, BLACK);
  disc(img, 390, 140, 70, [255, 111, 152, 255]);
  ring(img, 390, 140, 70, 10, BLACK);
  disc(img, 240, 300, 22, BLACK);
  disc(img, 360, 300, 22, BLACK);
  return img;
}

const out = path.join(__dirname);
const fixtures: Record<string, () => RgbaImage> = {
  face,
  star,
  gradient,
  'dark-on-dark': darkOnDark,
  transparent,
  'thin-lines': thinLines,
  highlight,
};
for (const [name, make] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(out, `${name}.png`), encodePng(resizeArea(make(), OUT, OUT)));
  console.log(`wrote ${name}.png`);
}
