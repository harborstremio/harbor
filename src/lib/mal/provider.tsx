import { openUrl } from "@/lib/window";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { buildAuthorizeUrl, completeAuthorization } from "./auth";
import { getSession, isAuthenticated, setSession, subscribeSession } from "./session";
import type { MalSession } from "./types";
import { validateMalSession } from "./validate";
export type ConnectState =
  | { kind: "idle" }
  | { kind: "needs-code" }
  | { kind: "verifying" }
  | { kind: "error"; message: string }
  | { kind: "success"; session: MalSession };

type Value = {
  session: MalSession | null;
  isConnected: boolean;
  userName: string | null;
  connectState: ConnectState;
  beginConnect: () => void;
  submitCode: (code: string) => void;
  cancelConnect: () => void;
  disconnect: () => void;
};

const Ctx = createContext<Value | null>(null);

export function MalProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<MalSession | null>(() => getSession());
  const [connectState, setConnectState] = useState<ConnectState>({ kind: "idle" });

  useEffect(() => subscribeSession(() => setLocalSession(getSession())), []);

  useEffect(() => {
    void validateMalSession();
  }, [session?.accessToken]);

  const beginConnect = useCallback(() => {
    try {
      const url = buildAuthorizeUrl();
      setConnectState({ kind: "needs-code" });
      openUrl(url);
    } catch (e) {
      setConnectState({
        kind: "error",
        message: e instanceof Error ? e.message : "MyAnimeList is not configured in this build.",
      });
    }
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

export function useMal(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMal outside MalProvider");
  return v;
}
