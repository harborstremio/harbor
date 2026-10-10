const GLOBAL_CONCURRENCY = 8;

let inflight = 0;
const queue: Array<() => void> = [];

/** One gate for every call into a plugin, a title search or a catalogue browse alike, so neither
 * can crowd the other out of the runtime. */
export function acquire(): Promise<void> {
  if (inflight < GLOBAL_CONCURRENCY) {
    inflight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(() => {
      inflight += 1;
      resolve();
    });
  });
}

export function release(): void {
  inflight -= 1;
  const next = queue.shift();
  if (next) next();
}
