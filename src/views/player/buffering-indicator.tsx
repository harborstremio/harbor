import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayerStatus } from "@/lib/player/bridge";
import {
  advanceBufferingIndicator,
  initialBufferingIndicatorState,
} from "./buffering-indicator-state";

export function BufferingIndicator({
  buffering,
  status,
  suppressed,
}: {
  buffering: boolean;
  status: PlayerStatus;
  suppressed: boolean;
}) {
  const stateRef = useRef(initialBufferingIndicatorState());
  const [visible, setVisible] = useState(false);
  const eligible = !suppressed && status === "playing" && getPlaybackPosition() > 0.3;

  useEffect(() => {
    const sample = () => {
      const next = advanceBufferingIndicator(stateRef.current, {
        buffering,
        eligible,
        nowMs: performance.now(),
        positionSec: getPlaybackPosition(),
      });
      stateRef.current = next;
      setVisible((current) => (current === next.visible ? current : next.visible));
    };

    sample();
    if (!buffering || !eligible) return;
    const timer = window.setInterval(sample, 100);
    return () => window.clearInterval(timer);
  }, [buffering, eligible]);

  const playPauseButton = visible
    ? document.querySelector<HTMLElement>("[data-player-play-pause]")
    : null;
  if (!playPauseButton) return null;
  return createPortal(
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -inset-1 rounded-full border-2 border-white/15 border-r-white/35 border-t-white/70 motion-safe:animate-spin"
    />,
    playPauseButton,
  );
}
