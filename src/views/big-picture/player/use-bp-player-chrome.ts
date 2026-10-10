import { useCallback, useEffect, useRef, useState } from "react";
import type { BpChromePhase } from "./bp-player-context";

const IDLE_UP_MS = 4600;
const PEEK_MS = 1800;
const ACTIVITY_THROTTLE_MS = 260;
const FADE_MS = 320;

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export type BpPlayerChrome = {
  phase: BpChromePhase;
  /** Stays true through the fade-out so the chrome does not cut to black. */
  mounted: boolean;
  wakeChrome: () => void;
  peekChrome: () => void;
  hideChrome: () => void;
  holdChrome: (held: boolean) => void;
};

/**
 * Owns when the 10-foot chrome is on screen. Deliberately independent of the
 * desktop player's own chrome timer: that one wakes on mouse movement and hides
 * on a keyboard pause, neither of which describes a remote in a living room.
 */
export function useBpPlayerChrome(params: {
  playing: boolean;
  pinned: boolean;
}): BpPlayerChrome {
  const { playing, pinned } = params;
  const [phase, setPhase] = useState<BpChromePhase>("up");
  const [mounted, setMounted] = useState(true);
  const [held, setHeld] = useState(false);
  const [activity, setActivity] = useState(0);
  const lastNote = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // A held D-pad direction repeats every few frames. Restarting the countdown
  // on each repeat would re-render the whole surface at controller repeat rate,
  // so the refresh is throttled far below the window it is refreshing.
  const noteActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastNote.current < ACTIVITY_THROTTLE_MS) return;
    lastNote.current = now;
    setActivity((n) => n + 1);
  }, []);

  const wakeChrome = useCallback(() => {
    setMounted(true);
    setPhase("up");
    lastNote.current = 0;
    setActivity((n) => n + 1);
  }, []);

  const peekChrome = useCallback(() => {
    setMounted(true);
    if (phaseRef.current !== "up") setPhase("peek");
    noteActivity();
  }, [noteActivity]);

  const hideChrome = useCallback(() => setPhase("down"), []);

  // A paused film is a title card, so the chrome stays. Only a running picture
  // earns the countdown, and a pinned panel or an open menu suspends it. The
  // activity counter is what makes every keypress restart the wait: without it
  // the chrome walks out from under someone who is still pressing buttons.
  useEffect(() => {
    if (phase === "down") return;
    if (phase === "peek") {
      const id = window.setTimeout(() => setPhase("down"), PEEK_MS);
      return () => window.clearTimeout(id);
    }
    if (!playing || pinned || held) return;
    const id = window.setTimeout(() => setPhase("down"), IDLE_UP_MS);
    return () => window.clearTimeout(id);
  }, [phase, playing, pinned, held, activity]);

  useEffect(() => {
    if (phase !== "down") return;
    if (reducedMotion()) {
      setMounted(false);
      return;
    }
    const id = window.setTimeout(() => setMounted(false), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Capture phase, and it never reads or consumes the key. The shell's spatial
  // listener calls stopPropagation, which would starve a bubble listener here
  // but leaves other capture listeners on the same object alone.
  useEffect(() => {
    if (phase !== "up") return;
    window.addEventListener("keydown", noteActivity, true);
    return () => window.removeEventListener("keydown", noteActivity, true);
  }, [phase, noteActivity]);

  return { phase, mounted, wakeChrome, peekChrome, hideChrome, holdChrome: setHeld };
}
