import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSimklProfile,
  fetchSimklProfileStats,
  type SimklProfile,
  type SimklProfileErrorReason,
  type SimklProfileStats,
} from "@/lib/simkl/profile";
import { getSession, subscribeSession } from "@/lib/simkl/session";

export type SimklCardStats =
  | { kind: "loading" }
  | { kind: "ready"; stats: SimklProfileStats }
  | { kind: "unavailable" };

export type SimklCardState =
  | { kind: "disconnected" }
  | { kind: "loading" }
  | { kind: "error"; reason: SimklProfileErrorReason; detail: string; retryable: boolean }
  | { kind: "ready"; profile: SimklProfile; stats: SimklCardStats };

export type SimklCardController = {
  state: SimklCardState;
  username: string | null;
  reload: () => void;
};

function isRetryable(reason: SimklProfileErrorReason): boolean {
  return reason === "throttled" || reason === "network" || reason === "server";
}

export function useSimklCard(
  opts: { includeStats?: boolean; enabled?: boolean } = {},
): SimklCardController {
  const includeStats = opts.includeStats !== false;
  const enabled = opts.enabled !== false;
  const [connected, setConnected] = useState(() => enabled && !!getSession());
  const [username, setUsername] = useState<string | null>(() => getSession()?.username ?? null);
  const [state, setState] = useState<SimklCardState>(() =>
    getSession() ? { kind: "loading" } : { kind: "disconnected" },
  );
  const [nonce, setNonce] = useState(0);
  const forceRef = useRef(false);

  const reload = useCallback(() => {
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  useEffect(
    () =>
      subscribeSession(() => {
        const session = getSession();
        setConnected(enabled && !!session);
        setUsername(session?.username ?? null);
      }),
    [],
  );

  useEffect(() => {
    if (!enabled || !connected) {
      setState((cur) => (cur.kind === "disconnected" ? cur : { kind: "disconnected" }));
      return;
    }
    const force = forceRef.current;
    forceRef.current = false;
    let cancelled = false;
    setState((cur) => (cur.kind === "loading" ? cur : { kind: "loading" }));

    void fetchSimklProfile({ force })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setState(
            result.reason === "not-connected"
              ? { kind: "disconnected" }
              : {
                  kind: "error",
                  reason: result.reason,
                  detail: result.detail,
                  retryable: isRetryable(result.reason),
                },
          );
          return;
        }
        setState({
          kind: "ready",
          profile: result.profile,
          stats: includeStats ? { kind: "loading" } : { kind: "unavailable" },
        });
        if (!includeStats) return;
        void fetchSimklProfileStats()
          .then((s) => {
            if (cancelled) return;
            const next: SimklCardStats = s.ok
              ? { kind: "ready", stats: s.stats }
              : { kind: "unavailable" };
            setState((cur) => (cur.kind === "ready" ? { ...cur, stats: next } : cur));
          })
          .catch(() => {
            if (cancelled) return;
            setState((cur) =>
              cur.kind === "ready" ? { ...cur, stats: { kind: "unavailable" } } : cur,
            );
          });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          reason: "network",
          detail: e instanceof Error ? e.message : String(e),
          retryable: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connected, nonce, includeStats, enabled]);

  return useMemo(() => ({ state, username, reload }), [state, username, reload]);
}
