import { useCallback, useEffect, useRef, useState } from "react";
import {
  REMOTE_PROTO,
  remoteWsUrl,
  type RemoteClientMessage,
  type RemoteCommand,
  type RemoteServerMessage,
  type RemoteSnapshot,
  idleSnapshot,
} from "./protocol";

export type RemoteClientStatus = "idle" | "connecting" | "connected" | "error";

const RETRY_BASE_MS = 400;
const RETRY_CAP_MS = 3000;

function defaultHost(): string {
  if (typeof location === "undefined") return "127.0.0.1";
  if (location.hostname && location.hostname !== "localhost") return location.hostname;
  return "127.0.0.1";
}

/**
 * Mobile browsers freeze timers and leave dead WebSockets when the tab is
 * backgrounded. Strategy: drop the socket on hide, open a fresh one on show —
 * never wait on backoff or ping probes after resume.
 */
export function useRemoteClient(initialHost?: string) {
  const [host, setHost] = useState(initialHost || defaultHost());
  const [status, setStatus] = useState<RemoteClientStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RemoteSnapshot>(() => idleSnapshot());
  const wsRef = useRef<WebSocket | null>(null);
  const hostRef = useRef(host);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualClose = useRef(false);
  const parkedRef = useRef(false);
  const ignoreClose = useRef(new WeakSet<WebSocket>());
  const connectRef = useRef<(nextHost?: string) => void>(() => {});
  const unparkCoalesceRef = useRef(false);

  hostRef.current = host;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const send = useCallback((msg: RemoteClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const sendCommand = useCallback((command: RemoteCommand) => send({ t: "cmd", command }), [send]);

  const disconnect = useCallback(() => {
    manualClose.current = true;
    parkedRef.current = false;
    clearRetryTimer();
    const ws = wsRef.current;
    if (ws) {
      ignoreClose.current.add(ws);
      ws.close();
    }
    wsRef.current = null;
    setStatus("idle");
  }, [clearRetryTimer]);

  const connect = useCallback(
    (nextHost?: string) => {
      const h = (nextHost ?? hostRef.current).trim() || "127.0.0.1";
      setHost(h);
      hostRef.current = h;
      manualClose.current = false;
      parkedRef.current = false;
      clearRetryTimer();

      const prev = wsRef.current;
      if (prev) {
        ignoreClose.current.add(prev);
        prev.close();
        wsRef.current = null;
      }

      setStatus((s) => (s === "error" ? "error" : "connecting"));
      setError(null);
      const ws = new WebSocket(remoteWsUrl(h));
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("connected");
        send({ t: "hello", client: "harbor-remote", proto: REMOTE_PROTO });
        // Do not castDiscover here — reconnect/refresh storms overlap native
        // DLNA discovery and have hard-crashed the host (heap corruption).
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as RemoteServerMessage;
          if (msg.t === "snapshot") setSnapshot(msg.snapshot);
          if (msg.t === "error") setError(msg.message);
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        if (ignoreClose.current.has(ws) || parkedRef.current) return;
        setError("Could not reach Harbor remote WebSocket.");
        setStatus("error");
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (ignoreClose.current.has(ws) || manualClose.current || parkedRef.current) return;

        setStatus("error");
        // Don't schedule retries while backgrounded — timers are frozen/throttled
        // and leave you waiting after the phone comes back.
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

        const delay = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** retryRef.current);
        retryRef.current += 1;
        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (!manualClose.current && !parkedRef.current) connectRef.current(h);
        }, delay);
      };
    },
    [clearRetryTimer, send],
  );

  connectRef.current = connect;

  /** App/tab backgrounded: tear down WS now so resume isn't stuck on a zombie. */
  const park = useCallback(() => {
    if (manualClose.current) return;
    parkedRef.current = true;
    clearRetryTimer();
    const ws = wsRef.current;
    if (!ws) return;
    ignoreClose.current.add(ws);
    ws.close();
    wsRef.current = null;
  }, [clearRetryTimer]);

  /** App/tab foregrounded: always open a new socket immediately. */
  const unpark = useCallback(() => {
    if (manualClose.current) return;
    if (unparkCoalesceRef.current) return;
    unparkCoalesceRef.current = true;
    queueMicrotask(() => {
      unparkCoalesceRef.current = false;
      if (manualClose.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      parkedRef.current = false;
      clearRetryTimer();
      retryRef.current = 0;

      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      connectRef.current();
    });
  }, [clearRetryTimer]);

  useEffect(() => {
    connect();
    return () => {
      manualClose.current = true;
      clearRetryTimer();
      const ws = wsRef.current;
      if (ws) {
        ignoreClose.current.add(ws);
        ws.close();
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") park();
      else unpark();
    };
    const onPageHide = () => park();
    const onPageShow = () => unpark();
    const onFreeze = () => park();
    const onResume = () => unpark();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("freeze", onFreeze);
    document.addEventListener("resume", onResume);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("freeze", onFreeze);
      document.removeEventListener("resume", onResume);
    };
  }, [park, unpark]);

  return {
    host,
    setHost,
    status,
    error,
    snapshot,
    connect,
    disconnect,
    sendCommand,
  };
}
