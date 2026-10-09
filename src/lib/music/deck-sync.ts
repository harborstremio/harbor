import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DeckAdoptRequest } from "./deck-primary";
import type { MusicPlayerState } from "./types";

const EVENT = "harbor://music-sync";
const ASK = "harbor://music-sync-ask";
const CMD = "harbor://music-command";
const ADOPTED = "harbor://music-adopted";
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type DeckSnapshot = Pick<
  MusicPlayerState,
  | "phase"
  | "current"
  | "queue"
  | "queueIndex"
  | "currentTime"
  | "duration"
  | "volume"
  | "likedIds"
  | "error"
>;

function label(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

export function isDeckWindow(): boolean {
  return label() === "harbor-dj";
}

let lastKey = "";

export function broadcastDeckState(state: MusicPlayerState, force = false): void {
  if (!IS_TAURI || isDeckWindow()) return;
  const key = `${state.phase}|${state.current?.id ?? ""}|${state.queueIndex}|${state.queue.length}|${Math.round(state.currentTime)}|${state.likedIds.length}|${state.error ?? ""}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  const snapshot: DeckSnapshot = {
    phase: state.phase,
    current: state.current,
    queue: state.queue,
    queueIndex: state.queueIndex,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    likedIds: state.likedIds,
    error: state.error,
  };
  void emit(EVENT, snapshot).catch(() => {});
}

export function answerDeckRequests(read: () => MusicPlayerState): () => void {
  if (!IS_TAURI || isDeckWindow()) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  void listen(ASK, () => broadcastDeckState(read(), true))
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

export function subscribeDeckState(apply: (snapshot: DeckSnapshot) => void): () => void {
  if (!IS_TAURI) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  let retry = 0;
  const settled = () => {
    if (!retry) return;
    window.clearInterval(retry);
    retry = 0;
  };
  void listen<DeckSnapshot>(EVENT, (event) => {
    settled();
    apply(event.payload);
  })
    .then((off) => {
      if (live) stop = off;
      else off();
    })
    .catch(() => {});
  void emit(ASK, {}).catch(() => {});
  retry = window.setInterval(() => void emit(ASK, {}).catch(() => {}), 4000);
  return () => {
    live = false;
    settled();
    stop?.();
  };
}

export type DeckCommand =
  | { kind: "toggle" }
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "seek"; seconds: number }
  | { kind: "loop"; start: number | null; end: number | null }
  | { kind: "volume"; value: number }
  | { kind: "like" }
  | { kind: "retry" }
  | { kind: "dismissError" }
  | ({ kind: "adopt"; nonce: number } & DeckAdoptRequest);

export type DeckAdoptAck = { nonce: number; deck: number; landed: boolean };

export function sendDeckCommand(command: DeckCommand): void {
  if (!IS_TAURI) return;
  void emit(CMD, command).catch(() => {});
}

export function sendDeckAdopted(ack: DeckAdoptAck): void {
  if (!IS_TAURI || isDeckWindow()) return;
  void emit(ADOPTED, ack).catch(() => {});
}

export function subscribeDeckAdopted(apply: (ack: DeckAdoptAck) => void): () => void {
  if (!IS_TAURI) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  void listen<DeckAdoptAck>(ADOPTED, (event) => apply(event.payload))
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

export async function scratchDeck(
  position: number,
  rate: number,
  holding: boolean,
): Promise<number | null> {
  if (!IS_TAURI) return null;
  try {
    return await invoke<number>("music_deck_scratch", { position, rate, holding });
  } catch {
    return null;
  }
}

export function serveDeckCommands(run: (command: DeckCommand) => void): () => void {
  if (!IS_TAURI || isDeckWindow()) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  void listen<DeckCommand>(CMD, (event) => run(event.payload))
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
