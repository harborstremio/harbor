import { useEffect, useRef, useState } from "react";
import type { CompanionObservation } from "@/lib/games/companion-request";

/** Keep observations on same-key refresh; never show a previous champion's response. */
export function useLeagueFeed<T>(key: string, enabled: boolean, attempt: number, load: (signal: AbortSignal, refresh: boolean) => Promise<CompanionObservation<T>>) {
  const [state, setState] = useState<{ key: string; data: T | null; at: number; busy: boolean; failed: boolean }>({ key, data: null, at: 0, busy: false, failed: false });
  const loader = useRef(load); loader.current = load;
  const previous = useRef({ key, attempt });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(), refresh = previous.current.key === key && previous.current.attempt !== attempt;
    previous.current = { key, attempt };
    setState(s => ({ key, data: s.key === key ? s.data : null, at: s.key === key ? s.at : 0, busy: true, failed: false }));
    void loader.current(controller.signal, refresh).then(result => { if (!controller.signal.aborted) setState({ key, data: result.data, at: result.at, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setState(s => ({ ...s, busy: false, failed: true })); });
    return () => controller.abort();
  }, [key, enabled, attempt]);
  return state.key === key ? state : { key, data: null, at: 0, busy: enabled, failed: false };
}
