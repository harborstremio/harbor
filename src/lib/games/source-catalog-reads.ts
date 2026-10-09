import type { GameSource } from './sources';

type Read = { controller: AbortController; promise: Promise<GameSource[]>; consumers: number; settled: boolean };

/** Concurrent source views share work; leaving one view must not cancel another. */
export function createSourceCatalogReads(load: (profile: string, signal: AbortSignal) => Promise<GameSource[]>) {
  const pending = new Map<string, Read>();
  return {
    forget(profile: string) { pending.delete(profile); },
    read(profile: string, signal?: AbortSignal): Promise<GameSource[]> {
      if (signal?.aborted) return Promise.reject(signal.reason);
      let job = pending.get(profile);
      if (!job) {
        const controller = new AbortController();
        job = { controller, consumers: 0, settled: false,
          promise: Promise.resolve().then(() => { controller.signal.throwIfAborted(); return load(profile, controller.signal); }) };
        pending.set(profile, job);
        const held = job;
        const clear = () => { held.settled = true; if (pending.get(profile) === held) pending.delete(profile); };
        void held.promise.then(clear, clear);
      }
      const held = job; held.consumers++;
      return new Promise((resolve, reject) => {
        let active = true;
        const release = () => {
          if (!active) return;
          active = false; signal?.removeEventListener('abort', abort); held.consumers--;
          if (!held.settled && !held.consumers) {
            if (pending.get(profile) === held) pending.delete(profile);
            held.controller.abort();
          }
        };
        const abort = () => { release(); reject(signal?.reason); };
        signal?.addEventListener('abort', abort, { once: true });
        void held.promise.then(value => { if (active) { release(); resolve(value); } }, error => { if (active) { release(); reject(error); } });
      });
    },
  };
}
