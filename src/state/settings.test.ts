import { createSettingsStore, DEFAULT_SETTINGS, parseSettings, type SettingsRepo } from './settings';

function memRepo(initial: string | null = null) {
  let data = initial;
  let fail = false;
  const repo: SettingsRepo & { data(): string | null; fail(on: boolean): void } = {
    async read() {
      return data;
    },
    async write(s) {
      if (fail) throw new Error('disk full');
      data = s;
    },
    data: () => data,
    fail: (on) => (fail = on),
  };
  return repo;
}

test('parse broken json → defaults', () => {
  expect(parseSettings('{')).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings('{"panelSide":"up"}')).toEqual(DEFAULT_SETTINGS);
});

test('calibration clamped to 0.90..1.10', () => {
  expect(parseSettings('{"calibration":2,"calibrated":true,"panelSide":"left"}')).toEqual({ calibration: 1.1, calibrated: true, panelSide: 'left' });
  expect(parseSettings('{"calibration":0.5}').calibration).toBe(0.9);
});

test('load reads the repo; missing file → defaults', async () => {
  const s = createSettingsStore(memRepo('{"calibration":1.02,"calibrated":true,"panelSide":"left"}'));
  await s.getState().load();
  expect(s.getState().settings).toEqual({ calibration: 1.02, calibrated: true, panelSide: 'left' });
  const empty = createSettingsStore(memRepo(null));
  await empty.getState().load();
  expect(empty.getState().settings).toEqual(DEFAULT_SETTINGS);
  expect(empty.getState().loaded).toBe(true);
});

test('setCalibration persists and marks calibrated', async () => {
  const repo = memRepo();
  const s = createSettingsStore(repo);
  await s.getState().setCalibration(1.004);
  expect(s.getState().settings.calibrated).toBe(true);
  expect(JSON.parse(repo.data()!)).toEqual({ calibration: 1.004, calibrated: true, panelSide: 'right' });
  await s.getState().reset();
  expect(s.getState().settings).toEqual(DEFAULT_SETTINGS);
});

test('save failure keeps state', async () => {
  const repo = memRepo();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const s = createSettingsStore(repo);
  repo.fail(true);
  await s.getState().setPanelSide('left');
  expect(s.getState().settings.panelSide).toBe('left');
  warn.mockRestore();
});
