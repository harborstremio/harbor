import { createContext, useContext } from "react";
import type { PlayerSrc } from "@/lib/view";
import type { BpPlayback } from "./use-bp-playback";

/**
 * down  chrome away, the video is alone on screen.
 * peek  a slim scrub readout only, shown while seeking. Nothing focusable.
 * up    full chrome, and the shell owns the D-pad.
 */
export type BpChromePhase = "down" | "peek" | "up";

export type BpPlayerShellApi = {
  src: PlayerSrc;
  playback: BpPlayback;
  phase: BpChromePhase;
  chromeUp: boolean;
  /** Raise the full chrome and restart its idle countdown. */
  wakeChrome: () => void;
  /** Show only the scrub readout. Used by seeks, never focusable. */
  peekChrome: () => void;
  hideChrome: () => void;
  /** Pin the chrome open while a menu or a drag is in flight. */
  holdChrome: (held: boolean) => void;
  panel: string | null;
  openPanel: (id: string) => void;
  closePanel: () => void;
  togglePanel: (id: string) => void;
  /**
   * Leave playback now. This is the hard exit and it skips the leave
   * confirmation on purpose, for a control the user pressed deliberately. The
   * confirming path is Back: the shell lets a second Back fall through
   * uncaught to the player's own Escape handling.
   */
  exit: () => void;
};

const Ctx = createContext<BpPlayerShellApi | null>(null);

export const BpPlayerProvider = Ctx.Provider;

export function useBpPlayerOptional(): BpPlayerShellApi | null {
  return useContext(Ctx);
}

export function useBpPlayer(): BpPlayerShellApi {
  const value = useContext(Ctx);
  if (!value) throw new Error("useBpPlayer outside BpPlayerShell");
  return value;
}
