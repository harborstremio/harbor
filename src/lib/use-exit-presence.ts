import { useEffect, useRef, useState } from "react";

export function useExitPresence(open: boolean, exitMs: number): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const mountedRef = useRef(open);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      mountedRef.current = true;
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mountedRef.current) return;
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      mountedRef.current = false;
      setClosing(false);
      setMounted(false);
    }, exitMs);
  }, [open, exitMs]);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { mounted, closing };
}
