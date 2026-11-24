/**
 * タイトル画面のビーズ絵を作る：画像をアプリと同じ変換（core/convert）でビーズにして PNG に描く。
 *   npm run title:beads -- <入力画像> <出力 PNG> [サイズ=58] [用途=illust|photo]
 * 出力は、ビーズのある段だけを切り出し、背景（ビーズのないマス）は透明。
 */
import fs from 'node:fs';

import { convertImage } from '../../src/core/convert/convert';
import { defaultConvertSettings } from '../../src/core/convert/types';
import { ALL64, beadByIndex } from '../../src/core/palette/perler';
import type { SheetSize } from '../../src/core/sheet/sheet';
import { encodePng, readImage } from '../compare/image-io';

const [input, output, sizeArg = '58', presetArg = 'illust'] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: make-title-beads <input> <output.png> [size] [illust|photo]');
const size = Number(sizeArg) as SheetSize;
const img = readImage(input);
const sheet = convertImage(img, {
  ...defaultConvertSettings(size),
  preset: presetArg === 'photo' ? 'photo' : 'illust',
  beadSet: 'owned',
  allowedBeads: [...ALL64],
  removeBackground: false,
  noise: 1,
});
// ビーズのある範囲（行・列）だけを描く
let maxX = 0;
let maxY = 0;
for (let y = 0; y < sheet.height; y++)
  for (let x = 0; x < sheet.width; x++)
    if (sheet.cells[y * sheet.width + x]) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
const cols = maxX + 1;
const rows = maxY + 1;
const cell = 16;
const W = cols * cell;
const H = rows * cell;
const data = new Uint8ClampedArray(W * H * 4); // 透明
const r = cell * 0.47;
const hole = cell * 0.14;
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const v = sheet.cells[cy * sheet.width + cx];
    if (!v) continue;
    const [R, G, B] = beadByIndex(v).rgb;
    const ox = cx * cell + cell / 2;
    const oy = cy * cell + cell / 2;
    for (let y = cy * cell; y < (cy + 1) * cell; y++) {
      for (let x = cx * cell; x < (cx + 1) * cell; x++) {
        const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
        // ふちをなめらかに（1px のアンチエイリアス）
        const a = Math.max(0, Math.min(1, r - d + 0.5));
        if (a <= 0) continue;
        // 真ん中の穴は少し暗く（ビーズらしく見せる）。白に近いビーズは、白い背景で見えるように薄い縁を描く
        const light = R > 225 && G > 225 && B > 225;
        const edge = light && d > r - 1.2;
        const shade = d < hole ? 0.78 : 1;
        const c = edge ? [200, 200, 206] : [R * shade, G * shade, B * shade];
        data.set([Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(255 * a)], (y * W + x) * 4);
      }
    }
  }
}
fs.writeFileSync(output, encodePng({ width: W, height: H, data }));
console.log(`${output}: ${cols}×${rows} マス、${new Set(sheet.cells).size - 1}色`);
