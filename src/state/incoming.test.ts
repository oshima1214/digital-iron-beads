import { isBeadsUrl, onIncoming, setIncoming, takeIncoming } from './incoming';

test('isBeadsUrl', () => {
  expect(isBeadsUrl('file:///private/var/mobile/Inbox/ねこ.beads')).toBe(true);
  expect(isBeadsUrl('file:///a/b.BEADS')).toBe(true);
  expect(isBeadsUrl('digitalironbeads://project/abc')).toBe(false);
  expect(isBeadsUrl('/project/abc')).toBe(false);
});

test('pending incoming file is taken once and listeners are notified', () => {
  const l = jest.fn();
  const off = onIncoming(l);
  setIncoming('file:///x.beads');
  expect(l).toHaveBeenCalledTimes(1);
  expect(takeIncoming()).toBe('file:///x.beads');
  expect(takeIncoming()).toBeNull();
  off();
});
