import { useEffect, useRef, useState } from "react";

/** Refresh live discovery while in use, and catch up once after returning. */
export function useLiveRefresh(active: boolean, interval = 16 * 60_000) {
  const [revision, setRevision] = useState(0);
  const last = useRef(Date.now());
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.hidden || Date.now() - last.current < interval) return;
      last.current = Date.now();
      setRevision(value => value + 1);
    };
    refresh();
    const timer = setInterval(refresh, Math.min(interval, 60_000));
    const reconnect = () => {
      if (document.hidden) { last.current = 0; return; }
      last.current = Date.now();
      setRevision(value => value + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", reconnect);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", reconnect);
    };
  }, [active, interval]);
  return revision;
}
