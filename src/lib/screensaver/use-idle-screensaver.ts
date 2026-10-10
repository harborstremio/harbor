import { useEffect, useRef, useState } from "react";

const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
const TICK_MS = 4000;

export function useIdleScreensaver(
  enabled: boolean,
  delayMs: number,
  suppressed: boolean,
): { active: boolean; dismiss: () => void } {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  activeRef.current = active;
  const lastRef = useRef(0);

  useEffect(() => {
    if (!enabled || suppressed) {
      if (activeRef.current) setActive(false);
      return;
    }
    lastRef.current = performance.now();
    const visible = () => document.visibilityState === "visible";
    const onActivity = () => {
      lastRef.current = performance.now();
      if (activeRef.current) setActive(false);
    };
    for (const ev of ACTIVITY) window.addEventListener(ev, onActivity, { passive: true });
    const bump = () => {
      if (visible()) lastRef.current = performance.now();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    const id = window.setInterval(() => {
      if (activeRef.current) return;
      if (!visible()) return;
      if (performance.now() - lastRef.current >= delayMs) setActive(true);
    }, TICK_MS);
    return () => {
      for (const ev of ACTIVITY) window.removeEventListener(ev, onActivity);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
      window.clearInterval(id);
    };
  }, [enabled, delayMs, suppressed]);

  return { active, dismiss: () => setActive(false) };
}
