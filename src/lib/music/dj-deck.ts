import { invoke } from "@tauri-apps/api/core";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function openDjDeck(): Promise<void> {
  if (!IS_TAURI) return Promise.resolve();
  return invoke<void>("dj_deck_open");
}

export function closeDjDeck(): Promise<void> {
  if (!IS_TAURI) return Promise.resolve();
  return invoke<void>("dj_deck_close");
}
