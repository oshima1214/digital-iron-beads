// iOS: Paths.document/settings.json
import { File, Paths } from 'expo-file-system';

import type { SettingsRepo } from '@/state/settings';

const file = () => new File(Paths.document, 'settings.json');

export const settingsRepo: SettingsRepo = {
  async read() {
    const f = file();
    return f.exists ? f.text() : null;
  },
  async write(json) {
    const f = file();
    if (!f.exists) f.create();
    await f.write(json);
  },
};
