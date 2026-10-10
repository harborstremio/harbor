import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, LoaderCircle } from "@/components/icons/music-icons";
import "./music-action-feedback.css";

export type MusicActionState = "idle" | "busy" | "done" | "error";

/** A receipt for a completed action. Already-saved items mount without celebrating again. */
export function MusicActionGlyph({
  state,
  idle,
  size = 18,
  identity,
}: {
  state: MusicActionState;
  idle: ReactNode;
  size?: number;
  identity?: string;
}) {
  const previous = useRef({ state, identity });
  const [arrived, setArrived] = useState(false);
  useLayoutEffect(() => {
    setArrived(
      state === "done" && previous.current.state !== "done" && previous.current.identity === identity,
    );
    previous.current = { state, identity };
  }, [state, identity]);

  return (
    <span
      className="music-action-glyph"
      style={{ width: size, height: size }}
      data-state={state}
      data-arrived={arrived || undefined}
      aria-hidden="true"
    >
      <span className="music-action-glyph-idle">{idle}</span>
      <span className="music-action-glyph-busy">
        <LoaderCircle size={size} />
      </span>
      <span className="music-action-glyph-done">
        <Check size={size} />
      </span>
    </span>
  );
}

/** Brief confirmation for immediate actions such as adding a collection to the queue. */
export function useMusicActionReceipt(identity?: string) {
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setConfirmed(false);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [identity]);
  const confirm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setConfirmed(true);
    timer.current = setTimeout(() => setConfirmed(false), 1200);
  }, []);
  return { confirmed, confirm };
}
