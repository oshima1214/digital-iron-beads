import { loadStatus } from './loadStatus';

test('error wins', () => {
  expect(loadStatus({ wanted: 'a', loaded: 'a', error: true })).toBe('error');
});
test('ready only when the wanted project is the loaded one and complete', () => {
  expect(loadStatus({ wanted: 'a', loaded: 'a', error: false })).toBe('ready');
  expect(loadStatus({ wanted: 'a', loaded: 'a', error: false, complete: false })).toBe('loading');
  expect(loadStatus({ wanted: 'a', loaded: 'b', error: false })).toBe('loading');
  expect(loadStatus({ wanted: 'a', loaded: undefined, error: false })).toBe('loading');
  expect(loadStatus({ wanted: undefined, loaded: undefined, error: false })).toBe('loading');
});
