import { openUrl } from "@/lib/window";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { buildAuthorizeUrl, completeAuthorization } from "./auth";
import { getSession, isAuthenticated, setSession, subscribeSession } from "./session";
import type { AnilistSession } from "./types";
import { validateAnilistSession } from "./validate";

export type ConnectState =
  | { kind: "idle" }
  | { kind: "needs-code" }
  | { kind: "verifying" }
  | { kind: "error"; message: string }
  | { kind: "success"; session: AnilistSession };

type Value = {
  session: AnilistSession | null;
  isConnected: boolean;
  userName: string | null;
  avatar: string | null;
  connectState: ConnectState;
  beginConnect: () => void;
  submitCode: (code: string) => void;
  cancelConnect: () => void;
  disconnect: () => void;
};

const Ctx = createContext<Value | null>(null);

export function AnilistProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<AnilistSession | null>(() => getSession());
  const [connectState, setConnectState] = useState<ConnectState>({ kind: "idle" });

  useEffect(() => subscribeSession(() => setLocalSession(getSession())), []);

  useEffect(() => {
    void validateAnilistSession();
  }, [session?.accessToken]);

  const beginConnect = useCallback(() => {
    openUrl(buildAuthorizeUrl());
    setConnectState({ kind: "needs-code" });
  }, []);

  const submitCode = useCallback((code: string) => {
    setConnectState({ kind: "verifying" });
    completeAuthorization(code)
      .then((final) => setConnectState({ kind: "success", session: final }))
      .catch((e: Error) => setConnectState({ kind: "error", message: e.message }));
  }, []);

  const cancelConnect = useCallback(() => setConnectState({ kind: "idle" }), []);

  const disconnect = useCallback(() => {
    setSession(null);
    setConnectState({ kind: "idle" });
  }, []);

  const value = useMemo<Value>(
    () => ({
      session,
      isConnected: !!session && isAuthenticated(),
      userName: session?.userName ?? null,
      avatar: session?.avatar ?? null,
      connectState,
      beginConnect,
      submitCode,
      cancelConnect,
      disconnect,
    }),
    [session, connectState, beginConnect, submitCode, cancelConnect, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnilist(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAnilist outside AnilistProvider");
  return v;
}
