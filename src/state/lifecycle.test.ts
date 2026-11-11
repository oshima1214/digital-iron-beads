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

test('flushAll runs flushers one after another in order', async () => {
  const log: string[] = [];
  const slow = async () => {
    await new Promise((r) => setTimeout(r, 20));
    log.push('a');
  };
  const fast = async () => {
    log.push('b');
  };
  await flushAll(slow, fast)();
  expect(log).toEqual(['a', 'b']);
});
