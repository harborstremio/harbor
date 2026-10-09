import { useEffect } from "react";
import { bpOverlayOpen, type BpDir } from "../bp-focus-core";
import { bpPlayerHandledKey } from "./bp-player-key";

const DIRS: Record<string, BpDir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function editing(): boolean {
  const active = document.activeElement as HTMLElement | null;
  return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
}

/**
 * The key owner while the 10-foot chrome is away. It is the counterpart to
 * useBpFocusRoot, which owns the arrows once the chrome is up, and the two are
 * never enabled at the same time: only one window listener may act on arrows.
 *
 * Left and Right are deliberately not consumed. The player's own seek is
 * user-rebindable and carries the short-step modifier, the hold-to-speed ramp
 * and the seek HUD, so the shell raises its scrub readout and gets out of the
 * way rather than reimplementing a thinner seek. Space is left alone for the
 * same reason: a gamepad's A button arrives here as Space.
 */
export function useBpPlayerIdleKeys(params: {
  enabled: boolean;
  onSummon: () => void;
  onPeek: () => void;
  onSelect: () => void;
  onOptions: () => void;
}): void {
  const { enabled, onSummon, onPeek, onSelect, onOptions } = params;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (bpOverlayOpen() || editing()) return;

      const dir = DIRS[e.key];
      if (dir) {
        // A surface that steps by its own model asks first. A decline falls
        // through, so nothing is swallowed on the way to the player's seek.
        if (bpPlayerHandledKey(dir)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (dir === "up" || dir === "down") {
          e.preventDefault();
          e.stopPropagation();
          onSummon();
          return;
        }
        onPeek();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        return;
      }

      if (e.key === " ") {
        onSummon();
        return;
      }

      if (e.key === "Tab" || e.key === "ContextMenu") {
        e.preventDefault();
        e.stopPropagation();
        onOptions();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, onSummon, onPeek, onSelect, onOptions]);
}
