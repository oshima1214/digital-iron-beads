export interface Autosaver<T> {
  /** 値を予約する。delayMs 以内に次の値が来たら最後の値だけを保存する。 */
  schedule(v: T): void;
  /** 予約中の値をすぐ保存する（アプリがバックグラウンドに移るときなど）。保存中なら終わるのを待つ。 */
  flush(): Promise<void>;
  readonly pending: boolean;
  readonly lastError: unknown;
}

export function createAutosaver<T>(save: (v: T) => Promise<void>, delayMs = 500): Autosaver<T> {
  let value: { v: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let lastError: unknown = null;

  const run = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (inflight) await inflight;
    if (!value) return;
    const current = value;
    value = null;
    inflight = (async () => {
      try {
        await save(current.v);
        lastError = null;
      } catch (e) {
        lastError = e;
        if (!value) value = current; // 失敗したら、新しい値が来ていなければ保持して再試行に回す
      }
    })();
    await inflight;
    inflight = null;
  };

  return {
    schedule(v: T) {
      value = { v };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    async flush() {
      await run();
      if (value && !lastError) await run(); // 保存中に予約された値
    },
    get pending() {
      return value !== null;
    },
    get lastError() {
      return lastError;
    },
  };
}
