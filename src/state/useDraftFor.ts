import { useEffect } from 'react';

import { draftStore, useDraft } from './draft';

/** URL の id の作品が下書きに読み込まれていることを保証する（アプリ再開・直接遷移のとき）。 */
export function useDraftFor(id: string | undefined): boolean {
  const loadedId = useDraft((s) => s.project?.id);
  const hasImage = useDraft((s) => s.image !== null);
  useEffect(() => {
    if (id && loadedId !== id) void draftStore().getState().open(id);
  }, [id, loadedId]);
  return !!id && loadedId === id && hasImage;
}
