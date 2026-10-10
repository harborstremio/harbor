import { useEffect, useState } from "react";
import { handleAvailable, localHandleCheck, normalizeHandle, type HandleCheck } from "@/lib/account/handle";

export type HandleStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "error" }
  | HandleCheck;

export function useHandleAvailability(raw: string, enabled: boolean): HandleStatus {
  const [status, setStatus] = useState<HandleStatus>({ state: "idle" });
  const handle = normalizeHandle(raw);

  useEffect(() => {
    if (!enabled || handle.length === 0) {
      setStatus({ state: "idle" });
      return;
    }
    const local = localHandleCheck(handle);
    if (local) {
      setStatus(local);
      return;
    }
    setStatus({ state: "checking" });
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      handleAvailable(handle, ac.signal)
        .then((res) => setStatus(res))
        .catch(() => {
          if (!ac.signal.aborted) setStatus({ state: "error" });
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [handle, enabled]);

  return status;
}
