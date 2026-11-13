import { existsSync } from 'fs';
import { join } from 'path';

import { NO_SWIPE_BACK_ROUTES } from './stackGestures';

describe('NO_SWIPE_BACK_ROUTES', () => {
  it('editor, nav and prepare screens disable swipe-back', () => {
    expect([...NO_SWIPE_BACK_ROUTES].sort()).toEqual(['nav/[id]', 'new/prepare', 'project/[id]']);
  });

  it.each(NO_SWIPE_BACK_ROUTES)('%s is an existing route file', (route) => {
    expect(existsSync(join(__dirname, '..', 'app', `${route}.tsx`))).toBe(true);
  });
});
