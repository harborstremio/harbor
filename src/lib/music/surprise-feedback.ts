import { useSyncExternalStore } from "react";
import type { MusicTrack } from "./types";

export type SurprisePromptStep = "idle" | "rate" | "redirect";
export type SurpriseFeedbackState = { step: SurprisePromptStep; heard: number; covers: string[] };

/** Long enough that the mix has shown its hand, short enough to still be worth asking. */
const ASK_AFTER = 4;
const COVERS = 3;

let state: SurpriseFeedbackState = { step: "idle", heard: 0, covers: [] };
let answered = false;
const listeners = new Set<() => void>();
const publish = (next: SurpriseFeedbackState) => { state = next; for (const listener of listeners) listener(); };

export function resetSurpriseFeedback(): void {
  answered = false;
  publish({ step: "idle", heard: 0, covers: [] });
}

/** Called once per track the mix actually reaches, never per player tick. */
export function noteSurpriseTrack(track: MusicTrack): void {
  if (answered) return;
  const artwork = typeof track.artwork === "string" ? track.artwork : "";
  const covers = artwork && !state.covers.includes(artwork) ? [...state.covers, artwork].slice(-COVERS) : state.covers;
  const heard = state.heard + 1;
  publish({ step: state.step === "idle" && heard >= ASK_AFTER ? "rate" : state.step, heard, covers });
}

export function surpriseEnjoyed(): void {
  answered = true;
  publish({ ...state, step: "idle" });
}

export function surpriseNotEnjoyed(): void {
  publish({ ...state, step: "redirect" });
}

export function dismissSurprisePrompt(): void {
  answered = true;
  publish({ ...state, step: "idle" });
}

export const surpriseFeedbackState = (): SurpriseFeedbackState => state;

export function useSurpriseFeedback(): SurpriseFeedbackState {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state,
    () => ({ step: "idle" as SurprisePromptStep, heard: 0, covers: [] }),
  );
}
