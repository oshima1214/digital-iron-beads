import { useEffect } from 'react';

import { type LoadStatus, loadStatus } from '@/core/machines/loadStatus';

import { draftStore, useDraft } from './draft';

export type DraftStatus = LoadStatus;

/** URL の id の作品が下書きに読み込まれていることを保証する（アプリ再開・直接遷移のとき）。 */
export function useDraftFor(id: string | undefined): DraftStatus {
  const loadedId = useDraft((s) => s.project?.id);
  const hasImage = useDraft((s) => s.image !== null);
  const error = useDraft((s) => s.error);
  useEffect(() => {
    if (id && loadedId !== id && !error) void draftStore().getState().open(id);
  }, [id, loadedId, error]);
  return loadStatus({ wanted: id, loaded: loadedId, error: !!error, complete: hasImage });
}
