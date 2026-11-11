import { createAutosaver } from './autosave';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('debounces: only the last value within 500ms is saved', async () => {
  const saved: number[] = [];
  const a = createAutosaver(async (v: number) => void saved.push(v));
  a.schedule(1);
  jest.advanceTimersByTime(300);
  a.schedule(2);
  jest.advanceTimersByTime(499);
  expect(saved).toEqual([]);
  await jest.advanceTimersByTimeAsync(1);
  expect(saved).toEqual([2]);
  expect(a.pending).toBe(false);
});

test('flush on background saves immediately and clears the timer', async () => {
  const saved: number[] = [];
  const a = createAutosaver(async (v: number) => void saved.push(v));
  a.schedule(7);
  await a.flush();
  expect(saved).toEqual([7]);
  await jest.advanceTimersByTimeAsync(1000);
  expect(saved).toEqual([7]);
});

test('failed save keeps the value pending and retries on next flush', async () => {
  let fail = true;
  const saved: number[] = [];
  const a = createAutosaver(async (v: number) => {
    if (fail) throw new Error('disk full');
    saved.push(v);
  });
  a.schedule(3);
  await jest.advanceTimersByTimeAsync(500);
  expect(a.pending).toBe(true);
  expect(a.lastError).toBeInstanceOf(Error);
  fail = false;
  await a.flush();
  expect(saved).toEqual([3]);
  expect(a.pending).toBe(false);
  expect(a.lastError).toBeNull();
});

test('flush with nothing pending does not call save', async () => {
  const save = jest.fn(async () => {});
  await createAutosaver(save).flush();
  expect(save).not.toHaveBeenCalled();
});

test('value scheduled during an in-flight save is saved afterwards', async () => {
  const saved: number[] = [];
  let release!: () => void;
  const a = createAutosaver(async (v: number) => {
    if (v === 1) await new Promise<void>((r) => (release = r));
    saved.push(v);
  });
  a.schedule(1);
  await jest.advanceTimersByTimeAsync(500);
  a.schedule(2);
  release();
  await a.flush();
  expect(saved).toEqual([1, 2]);
});
