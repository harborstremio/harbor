import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { completeAuthorization, pollForToken, requestPin, type PollHandle, type PollResult } from "./device-auth";
import { addToHistory } from "./history";
import { stremioIdToSimklTarget } from "./ids";
import { getSession, setSession, subscribeSession } from "./session";
import type { SimklPin, SimklSession, SimklTarget } from "./types";

export type ConnectState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "awaiting"; pin: SimklPin }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "success"; session: SimklSession };

type WatchArgs = { metaId: string; episode?: { season: number; episode: number } };

type Value = {
  session: SimklSession | null;
  isConnected: boolean;
  username: string | null;
  connectState: ConnectState;
  beginConnect: () => Promise<void>;
  cancelConnect: () => void;
  disconnect: () => void;
  markWatched: (args: WatchArgs) => Promise<void>;
  resolveTarget: (metaId: string, episode?: { season: number; episode: number }) => SimklTarget | null;
};

const Ctx = createContext<Value | null>(null);

export function SimklProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<SimklSession | null>(() => getSession());
  const [connectState, setConnectState] = useState<ConnectState>({ kind: "idle" });
  const pollHandleRef = useRef<PollHandle | null>(null);

  useEffect(
    () =>
      subscribeSession(() => {
        setLocalSession(getSession());
      }),
    [],
  );

  useEffect(() => {
    return () => {
      pollHandleRef.current?.cancel();
    };
  }, []);

  const beginConnect = useCallback(async () => {
    pollHandleRef.current?.cancel();
    setConnectState({ kind: "starting" });
    try {
      const pin = await requestPin();
      setConnectState({ kind: "awaiting", pin });
      pollHandleRef.current = pollForToken(pin, async (result: PollResult) => {
        if (result.kind === "authorized") {
          const final = await completeAuthorization(result.session);
          setConnectState({ kind: "success", session: final });
        } else if (result.kind === "expired") {
          setConnectState({ kind: "expired" });
        }
      });
    } catch (e) {
      setConnectState({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed to start authorization",
      });
    }
  }, []);

  const cancelConnect = useCallback(() => {
    pollHandleRef.current?.cancel();
    pollHandleRef.current = null;
    setConnectState({ kind: "idle" });
  }, []);

  const disconnect = useCallback(() => {
    pollHandleRef.current?.cancel();
    pollHandleRef.current = null;
    setSession(null);
    setConnectState({ kind: "idle" });
  }, []);

  const resolveTarget = useCallback((metaId: string, episode?: { season: number; episode: number }) => {
    const r = stremioIdToSimklTarget(metaId, episode);
    return r.ok ? r.target : null;
  }, []);

  const markWatched = useCallback(
    async (args: WatchArgs) => {
      const target = resolveTarget(args.metaId, args.episode);
      if (!target) return;
      if (!getSession()) return;
      await addToHistory(target);
    },
    [resolveTarget],
  );

  const value = useMemo<Value>(
    () => ({
      session,
      isConnected: !!session,
      username: session?.username ?? null,
      connectState,
      beginConnect,
      cancelConnect,
      disconnect,
      markWatched,
      resolveTarget,
    }),
    [session, connectState, beginConnect, cancelConnect, disconnect, markWatched, resolveTarget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimkl(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSimkl outside SimklProvider");
  return v;
}
