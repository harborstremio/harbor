export const DEFAULT_STILL_WATCHING_THRESHOLD = 3;

export type StillWatchingState<T> = {
  runCount: number;
  pending: T | null;
};

const emptyState: StillWatchingState<never> = { runCount: 0, pending: null };
const states = new Map<string, StillWatchingState<unknown>>();
const listeners = new Map<string, Set<() => void>>();

export function clampStillWatchingThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_STILL_WATCHING_THRESHOLD;
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function initialStillWatchingState<T>(): StillWatchingState<T> {
  return { runCount: 0, pending: null };
}

export function requestStillWatchingAdvance<T>(
  state: StillWatchingState<T>,
  pending: T,
  enabled: boolean,
  threshold: number,
): { state: StillWatchingState<T>; held: boolean } {
  if (!enabled) {
    return { state: initialStillWatchingState<T>(), held: false };
  }
  const limit = clampStillWatchingThreshold(threshold);
  if (state.runCount >= limit) {
    return {
      state: { runCount: state.runCount, pending },
      held: true,
    };
  }
  return {
    state: { runCount: state.runCount + 1, pending: null },
    held: false,
  };
}

export function resetStillWatchingRun<T>(state: StillWatchingState<T>): StillWatchingState<T> {
  return { ...state, runCount: 0 };
}

export function resolveStillWatchingPrompt<T>(state: StillWatchingState<T>): {
  state: StillWatchingState<T>;
  pending: T | null;
} {
  return {
    state: initialStillWatchingState<T>(),
    pending: state.pending,
  };
}

export function getStillWatchingState<T>(key: string): StillWatchingState<T> {
  return (states.get(key) ?? emptyState) as StillWatchingState<T>;
}

export function setStillWatchingState<T>(key: string, state: StillWatchingState<T>): void {
  states.set(key, state as StillWatchingState<unknown>);
  listeners.get(key)?.forEach((listener) => listener());
}

export function clearStillWatchingState(key: string): void {
  if (!states.delete(key)) return;
  listeners.get(key)?.forEach((listener) => listener());
}

export function subscribeStillWatchingState(key: string, listener: () => void): () => void {
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(key);
  };
}
