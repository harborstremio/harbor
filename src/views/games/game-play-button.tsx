import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";

import "./game-play-button.css";

/** Keep the control mounted and focused while its glyph follows actual launch state. */
export function GamePlayButton({ phase, label, ariaLabel = label, unavailable = false, className = "", iconSize = 24, onClick }: {
  phase: "ready" | "launching" | "running" | "repair"; label: string; ariaLabel?: string;
  unavailable?: boolean; className?: string; iconSize?: number; onClick: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null), motion = useRef<Animation | null>(null);
  const [attempt, setAttempt] = useState(0);
  const blocked = unavailable || phase === "launching" || phase === "running";
  useEffect(() => () => motion.current?.cancel(), []);
  return <button ref={button} className={`games-button games-button-primary games-play-feedback ${className}`} data-phase={phase} aria-label={ariaLabel} aria-disabled={blocked} aria-busy={phase === "launching" || undefined} onClick={() => {
    if (blocked) return;
    setAttempt(value => value + 1);
    // A brief compression and release remains visible even when native launch fails immediately.
    // The action itself starts immediately; feedback never invents a pending or running state.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      motion.current?.cancel();
      motion.current = button.current!.animate([{ transform: "scale(1.015,.96)" }, { transform: "scale(.99,1.02)", offset: .5 }, { transform: "scale(1.003,.995)", offset: .75 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-in-out" });
    }
    onClick();
  }}><span className="games-play-feedback-mark" data-activated={attempt > 0 || undefined} aria-hidden="true">
    <span className="games-play-glyph is-play"><Play size={iconSize}/></span>
    <span className="games-play-glyph is-launch"><span className="games-play-feedback-spinner"><i/><i/><i/></span></span>
    <span className="games-play-glyph is-running"><i/></span>
    <span className="games-play-glyph is-repair"><Settings2 size={19}/></span>
  </span><span key={label} className="games-play-feedback-label" aria-live="polite">{label}</span></button>;
}
