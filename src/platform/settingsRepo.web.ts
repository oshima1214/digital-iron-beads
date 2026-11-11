// Web（自動テスト用）: localStorage
import type { SettingsRepo } from '@/state/settings';

const KEY = 'dib:settings';

export const settingsRepo: SettingsRepo = {
  async read() {
    return localStorage.getItem(KEY);
  },
  async write(json) {
    localStorage.setItem(KEY, json);
  },
};
