export type RequestSchedulerSnapshot = {
  active: number;
  queued: number;
  inFlight: number;
};

export type RequestScheduler = {
  schedule<T>(key: string, task: () => Promise<T>): Promise<T>;
  pauseFor(milliseconds: number): void;
  snapshot(): RequestSchedulerSnapshot;
};

type QueueEntry<T> = {
  key: string;
  task: () => Promise<T>;
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function createRequestScheduler(options: { concurrency: number }): RequestScheduler {
  const concurrency = Math.floor(options.concurrency);
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new RangeError("request scheduler concurrency must be at least 1");
  }

  const queue: QueueEntry<unknown>[] = [];
  const inFlight = new Map<string, Promise<unknown>>();
  let active = 0;
  let pausedUntil = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const armPauseTimer = () => {
    if (pauseTimer != null) clearTimeout(pauseTimer);
    const remaining = Math.max(0, pausedUntil - Date.now());
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      drain();
    }, remaining);
  };

  const drain = () => {
    if (Date.now() < pausedUntil) {
      armPauseTimer();
      return;
    }
    while (active < concurrency && queue.length > 0) {
      const entry = queue.shift()!;
      active += 1;
      void (async () => {
        try {
          const value = await entry.task();
          active -= 1;
          if (inFlight.get(entry.key) === entry.promise) inFlight.delete(entry.key);
          drain();
          entry.resolve(value);
        } catch (error) {
          active -= 1;
          if (inFlight.get(entry.key) === entry.promise) inFlight.delete(entry.key);
          drain();
          entry.reject(error);
        }
      })();
    }
  };

  return {
    schedule<T>(key: string, task: () => Promise<T>): Promise<T> {
      const existing = inFlight.get(key) as Promise<T> | undefined;
      if (existing) return existing;

      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const entry: QueueEntry<T> = { key, task, promise, resolve, reject };
      inFlight.set(key, promise);
      queue.push(entry as QueueEntry<unknown>);
      drain();
      return promise;
    },

    pauseFor(milliseconds: number): void {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      pausedUntil = Math.max(pausedUntil, Date.now() + milliseconds);
      if (queue.length > 0) armPauseTimer();
    },

    snapshot(): RequestSchedulerSnapshot {
      return { active, queued: queue.length, inFlight: inFlight.size };
    },
  };
}
