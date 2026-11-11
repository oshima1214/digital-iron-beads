import { CORE_VERSION } from '@/core';

test('core module loads', () => {
  expect(CORE_VERSION).toBe(1);
});
