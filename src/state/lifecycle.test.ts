import { flushOnBackground } from './lifecycle';

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
