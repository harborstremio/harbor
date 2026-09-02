export const BP_TICK_MS = 10_000;

const listeners = new Set<() => void>();
let timer = 0;

export function subscribeBpTick(fn: () => void): () => void {
  listeners.add(fn);
  if (!timer) {
    timer = window.setInterval(() => {
      for (const f of listeners) f();
    }, BP_TICK_MS);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };
}
