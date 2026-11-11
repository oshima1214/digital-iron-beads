import { denoise } from './denoise';

test('denoise replaces isolated cell with 8-neighbor majority', () => {
  const cells = new Uint8Array([3, 3, 3, 3, 4, 3, 3, 3, 3]); // あかの中の ピンク（明るさの差が小さい）
  denoise(cells, 3, 3, 1, null);
  expect(cells[4]).toBe(3);
});

test('denoise respects protect', () => {
  const cells = new Uint8Array([3, 3, 3, 3, 8, 3, 3, 3, 3]);
  const protect = new Uint8Array(9);
  protect[4] = 1;
  denoise(cells, 3, 3, 1, protect);
  expect(cells[4]).toBe(8);
});

test('denoise strength 0 is no-op', () => {
  const cells = new Uint8Array([3, 3, 3, 3, 8, 3, 3, 3, 3]);
  denoise(cells, 3, 3, 0, null);
  expect(cells[4]).toBe(8);
});

test('denoise keeps connected pairs', () => {
  const cells = new Uint8Array([3, 3, 3, 3, 8, 8, 3, 3, 3]);
  denoise(cells, 3, 3, 2, null);
  expect([cells[4], cells[5]]).toEqual([8, 8]);
});

test('denoise removes a lone bead on background', () => {
  const cells = new Uint8Array([0, 0, 0, 0, 5, 0, 0, 0, 0]);
  denoise(cells, 3, 3, 1, null);
  expect(cells[4]).toBe(0);
});

test('denoise keeps a high-contrast single highlight (white on black)', () => {
  const cells = new Uint8Array([8, 8, 8, 8, 1, 8, 8, 8, 8]); // 8 = 5018 くろ, 1 = 5001 しろ
  denoise(cells, 3, 3, 2, null);
  expect(cells[4]).toBe(1);
});

test('denoise still removes a low-contrast single cell', () => {
  const cells = new Uint8Array([3, 3, 3, 3, 20, 3, 3, 3, 3]); // 5005 あか の中の 5059 しゅいろ
  denoise(cells, 3, 3, 1, null);
  expect(cells[4]).toBe(3);
});
