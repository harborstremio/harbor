import { remoteWsUrl } from "@/lib/remote/protocol";
import { mintHandoffNonce } from "./handoff-code";
import {
  HANDOFF_MSG,
  HANDOFF_PROTO,
  parseHandoffServerMessage,
  type HandoffClientCommand,
  type HandoffClientMessage,
  type HandoffOffer,
  type HandoffPayload,
  type HandoffReject,
} from "./handoff-protocol";

/**
 * Phone side. Opens its own socket rather than borrowing the remote client's,
 * because the setup page renders before the tab shell and its transport must
 * not depend on that shell being mounted.
 */

const RETRY_BASE_MS = 400;
const RETRY_CAP_MS = 3000;
/**
 * Must exceed the host's APPLY_TIMEOUT_MS. A sign-in against Stremio or the
 * ecosystem backend on hotel Wi-Fi can take double digit seconds, and giving up
 * first makes the phone report a failure for a step the TV then commits.
 */
const ACK_TIMEOUT_MS = 26_000;

export type HandoffClientReject = HandoffReject | "timeout" | "offline";
export type HandoffClientResult = { ok: true } | { ok: false; reason: HandoffClientReject };

export type HandoffConnection = "connecting" | "open" | "closed";

export type HandoffClientState = {
  connection: HandoffConnection;
  /** A live socket with a null offer means the TV is not on the setup screen. */
  offer: HandoffOffer | null;
  bound: boolean;
  lastReject: HandoffClientReject | null;
};

export type HandoffClient = {
  state(): HandoffClientState;
  subscribe(cb: () => void): () => void;
  claim(): Promise<HandoffClientResult>;
  deliver(payload: HandoffPayload): Promise<HandoffClientResult>;
  abandon(): void;
  /** Tab backgrounded: drop the socket now so resume is never stuck on a zombie. */
  park(): void;
  unpark(): void;
  close(): void;
};

type Waiter = {
  resolve: (r: HandoffClientResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

function defaultHost(): string {
  if (typeof location === "undefined") return "127.0.0.1";
  return location.hostname && location.hostname !== "localhost"
    ? location.hostname
    : "127.0.0.1";
}

export function createHandoffClient(token: string, host?: string): HandoffClient {
  const target = host || defaultHost();
  let ws: WebSocket | null = null;
  let closed = false;
  let parked = false;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const waiters = new Map<string, Waiter>();
  const listeners = new Set<() => void>();

  let state: HandoffClientState = {
    connection: "connecting",
    offer: null,
    bound: false,
    lastReject: null,
  };

  function set(next: Partial<HandoffClientState>): void {
    state = { ...state, ...next };
    for (const l of listeners) l();
  }

  function settleAll(reason: HandoffClientReject): void {
    for (const [, w] of waiters) {
      clearTimeout(w.timer);
      w.resolve({ ok: false, reason });
    }
    waiters.clear();
  }

  function send(cmd: HandoffClientCommand): Promise<HandoffClientResult> {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ ok: false, reason: "offline" as const });
    }
    const nonce = mintHandoffNonce();
    const msg: HandoffClientMessage = { t: HANDOFF_MSG, proto: HANDOFF_PROTO, nonce, cmd };
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      return Promise.resolve({ ok: false, reason: "offline" as const });
    }
    return new Promise<HandoffClientResult>((resolve) => {
      const timer = setTimeout(() => {
        waiters.delete(nonce);
        resolve({ ok: false, reason: "timeout" });
      }, ACK_TIMEOUT_MS);
      waiters.set(nonce, { resolve, timer });
    });
  }

  async function claim(): Promise<HandoffClientResult> {
    const r = await send({ kind: "claim", token });
    set({ bound: r.ok, lastReject: r.ok ? null : r.reason });
    return r;
  }

  function scheduleRetry(): void {
    if (closed || parked || retryTimer) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const delay = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** retry);
    retry += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  }

  function open(): void {
    if (closed) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    set({ connection: "connecting" });
    let sock: WebSocket;
    try {
      sock = new WebSocket(remoteWsUrl(target));
    } catch {
      set({ connection: "closed" });
      scheduleRetry();
      return;
    }
    ws = sock;

    sock.onopen = () => {
      if (ws !== sock) return;
      retry = 0;
      set({ connection: "open" });
      void claim();
    };

    sock.onmessage = (ev) => {
      if (ws !== sock) return;
      const msg = parseHandoffServerMessage(String(ev.data));
      if (!msg) return;
      const ack = msg.ack;
      if (ack) {
        const w = waiters.get(ack.nonce);
        if (w) {
          waiters.delete(ack.nonce);
          clearTimeout(w.timer);
          w.resolve(ack.ok ? { ok: true } : { ok: false, reason: ack.reason ?? "noOffer" });
        }
      }
      set({ offer: msg.offer });
    };

    const drop = () => {
      if (ws !== sock) return;
      ws = null;
      settleAll("offline");
      set({ connection: "closed", bound: false });
      scheduleRetry();
    };
    sock.onerror = drop;
    sock.onclose = drop;
  }

  open();

  return {
    state: () => state,

    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    claim,

    /** One silent re-claim covers the reconnect race, where the TV freed the binding. */
    async deliver(payload) {
      let r = await send({ kind: "deliver", token, payload });
      if (!r.ok && r.reason === "notBound") {
        const again = await claim();
        if (again.ok) r = await send({ kind: "deliver", token, payload });
      }
      set({ lastReject: r.ok ? null : r.reason });
      return r;
    },

    abandon() {
      void send({ kind: "abandon", token });
      set({ bound: false });
    },

    park() {
      if (closed) return;
      parked = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const sock = ws;
      ws = null;
      settleAll("offline");
      if (sock) sock.close();
      set({ connection: "closed", bound: false });
    },

    unpark() {
      if (closed) return;
      parked = false;
      retry = 0;
      open();
    },

    close() {
      closed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const sock = ws;
      ws = null;
      settleAll("offline");
      if (sock) sock.close();
      listeners.clear();
    },
  };
}
