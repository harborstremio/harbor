type Waiting = { start: () => void; cancel: () => void };

/** One operation at a time; visible work can pass waiting maintenance, never active work. */
export function createSourceWorkQueue() {
  const foreground: Waiting[] = [], background: Waiting[] = [];
  let active = false, foregroundTurns = 0;
  const drain = () => {
    if (active) return;
    const interactive = foreground.length > 0 && (background.length === 0 || foregroundTurns < 3);
    const next = (interactive ? foreground : background).shift();
    if (!next) { foregroundTurns = 0; return; }
    active = true;
    foregroundTurns = interactive ? foregroundTurns + 1 : 0;
    next.start();
  };
  const release = () => { active = false; queueMicrotask(drain); };
  return {
    run<T>(work: () => Promise<T>, interactive: boolean, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<T>((resolve, reject) => {
        const lane = interactive ? foreground : background;
        const waiting: Waiting = {
          start() {
            signal?.removeEventListener('abort', waiting.cancel);
            // Active work owns its cancellation and releases the lane only after cleanup.
            void Promise.resolve().then(work).then(resolve, reject).finally(release);
          },
          cancel() {
            const index = lane.indexOf(waiting);
            if (index < 0) return;
            lane.splice(index, 1);
            signal?.removeEventListener('abort', waiting.cancel);
            reject(signal?.reason);
          },
        };
        lane.push(waiting);
        signal?.addEventListener('abort', waiting.cancel, { once: true });
        queueMicrotask(drain);
      });
    },
  };
}
