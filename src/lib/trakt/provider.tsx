import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  completeAuthorization,
  pollForToken,
  requestDeviceCode,
  type PollHandle,
  type PollResult,
} from "./device-auth";
import { getSession, setSession, subscribeSession } from "./session";
import { stremioIdToTraktTarget, type TraktEpisodeRef } from "./ids";
import { scrobblePause, scrobbleStart, scrobbleStop } from "./scrobble";
import { pushWatched } from "./history";
import type { DeviceCode, TraktSession, TraktTarget } from "./types";

export type ConnectState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "awaiting"; device: DeviceCode }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "success"; session: TraktSession };

type ScrobbleArgs = {
  metaId: string;
  episode?: TraktEpisodeRef;
  progress: number;
};

type Value = {
  session: TraktSession | null;
  isConnected: boolean;
  username: string | null;
  connectState: ConnectState;
  beginConnect: () => Promise<void>;
  cancelConnect: () => void;
  disconnect: () => void;
  scrobble: (action: "start" | "pause" | "stop", args: ScrobbleArgs) => Promise<void>;
  resolveTarget: (metaId: string, episode?: TraktEpisodeRef) => TraktTarget | null;
};

const Ctx = createContext<Value | null>(null);

export function TraktProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<TraktSession | null>(() => getSession());
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
      const device = await requestDeviceCode();
      setConnectState({ kind: "awaiting", device });
      pollHandleRef.current = pollForToken(device, async (result: PollResult) => {
        if (result.kind === "authorized") {
          const final = await completeAuthorization(result.session);
          setConnectState({ kind: "success", session: final });
        } else if (result.kind === "expired") {
          setConnectState({ kind: "expired" });
        } else if (result.kind === "denied") {
          setConnectState({ kind: "denied" });
        } else if (result.kind === "error") {
          setConnectState({ kind: "error", message: result.message });
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

  const resolveTarget = useCallback((metaId: string, episode?: TraktEpisodeRef) => {
    const r = stremioIdToTraktTarget(metaId, episode);
    return r.ok ? r.target : null;
  }, []);

  const scrobble = useCallback(
    async (action: "start" | "pause" | "stop", args: ScrobbleArgs) => {
      const target = resolveTarget(args.metaId, args.episode);
      if (!target) return;
      if (!getSession()) return;
      const progress = Math.max(0, Math.min(100, args.progress));
      if (action === "start") await scrobbleStart(target, progress);
      else if (action === "pause") await scrobblePause(target, progress);
      else {
        const outcome = await scrobbleStop(target, progress);
        if (outcome === "failed") await pushWatched(target);
      }
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
      scrobble,
      resolveTarget,
    }),
    [session, connectState, beginConnect, cancelConnect, disconnect, scrobble, resolveTarget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrakt(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTrakt outside TraktProvider");
  return v;
}
