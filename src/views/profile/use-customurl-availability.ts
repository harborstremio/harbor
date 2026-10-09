import { useEffect, useState } from "react";
import { fetchSummary, ProfileNotFound } from "./profile-api";

export type UrlStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "mine";

export function useCustomUrlAvailability(value: string, ownHandle: string, ownCurrent: string): UrlStatus {
  const [status, setStatus] = useState<UrlStatus>("idle");

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) {
      setStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]{3,24}$/.test(v)) {
      setStatus("invalid");
      return;
    }
    if (v === ownHandle.toLowerCase() || v === ownCurrent.toLowerCase()) {
      setStatus("mine");
      return;
    }
    setStatus("checking");
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSummary(v, ac.signal)
        .then((s) => setStatus(s.isOwner ? "mine" : "taken"))
        .catch((e) => {
          if (ac.signal.aborted) return;
          setStatus(e instanceof ProfileNotFound ? "available" : "idle");
        });
    }, 400);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [value, ownHandle, ownCurrent]);

  return status;
}
