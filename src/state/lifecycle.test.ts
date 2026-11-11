import { flushAll, flushOnBackground } from './lifecycle';

test('flushes when the app leaves the active state and stops after unsubscribe', () => {
  let handler: ((s: string) => void) | null = null;
  const appState = { addEventListener: (_: 'change', h: (s: string) => void) => ((handler = h), { remove: () => (handler = null) }) };
  const flush = jest.fn(async () => {});
  const sub = flushOnBackground(appState, flush);
  handler!('active');
  expect(flush).not.toHaveBeenCalled();
  handler!('background');
  handler!('inactive');
  expect(flush).toHaveBeenCalledTimes(2);
  sub.remove();
  expect(handler).toBeNull();
});

test('flushAll runs all even if one rejects', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const a = jest.fn(async () => {
    throw new Error('a failed');
  });
  const b = jest.fn(async () => {});
  await flushAll(a, b)();
  expect(a).toHaveBeenCalled();
  expect(b).toHaveBeenCalled();
  warn.mockRestore();
});
