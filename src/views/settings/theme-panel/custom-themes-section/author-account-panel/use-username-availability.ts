import { useEffect, useState } from "react";
import { checkUsernameAvailable } from "@/lib/theme-auth";

export type Availability = "idle" | "checking" | "available" | "taken" | "error";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function useUsernameAvailability(username: string, enabled: boolean): Availability {
  const [state, setState] = useState<Availability>("idle");
  const trimmed = username.trim();

  useEffect(() => {
    if (!enabled || !USERNAME_RE.test(trimmed)) {
      setState("idle");
      return;
    }
    setState("checking");
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      checkUsernameAvailable(trimmed, ac.signal)
        .then((ok) => setState(ok ? "available" : "taken"))
        .catch(() => {
          if (!ac.signal.aborted) setState("error");
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [trimmed, enabled]);

  return state;
}
