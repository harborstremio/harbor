import { emit, listen } from "@tauri-apps/api/event";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const SELF = `w${Math.random().toString(36).slice(2)}`;

type Envelope<T> = { from: string; value: T };

export function broadcastWindowState<T>(channel: string, value: T): void {
  if (!IS_TAURI) return;
  void emit(channel, { from: SELF, value } satisfies Envelope<T>).catch(() => {});
}

export function subscribeWindowState<T>(channel: string, apply: (value: T) => void): () => void {
  if (!IS_TAURI) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  void listen<Envelope<T>>(channel, (event) => {
    if (!event.payload || event.payload.from === SELF) return;
    apply(event.payload.value);
  })
    .then((off) => {
      if (live) stop = off;
      else off();
    })
    .catch(() => {});
  return () => {
    live = false;
    stop?.();
  };
}
