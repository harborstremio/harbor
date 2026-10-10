import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  HANDOFF_MSG,
  HANDOFF_PROTO,
  parseHandoffEnvelope,
  type HandoffAck,
  type HandoffClientMessage,
  type HandoffOffer,
  type HandoffPayload,
  type HandoffReject,
  type HandoffServerMessage,
  type HandoffStepId,
} from "./handoff-protocol";
import { createHandoffSession, type HandoffSession } from "./handoff-session";

/**
 * TV side of the hand-off. Listens to the same `remote://cmd` stream the
 * remote host mount uses, on a message type that mount ignores, so no existing
 * file changes. Inbound frames carry the `clientId` the remote dispatcher
 * drops, and that id is the whole of the binding story.
 */

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** A wedged applier must not wedge the command queue behind it. */
const APPLY_TIMEOUT_MS = 20_000;

/** Codes already replaced. Recognised so a stale retry reads as expired. */
const RETIRED_KEEP = 6;

export type HandoffHostOptions = {
  steps: readonly HandoffStepId[];
  /** Applied on the TV. Throwing here refuses the step rather than eating it. */
  onPayload: (payload: HandoffPayload) => void | Promise<void>;
  onChange: (offer: HandoffOffer, token: string) => void;
  ttlMs?: number;
};

export type HandoffHost = {
  token(): string;
  offer(): HandoffOffer;
  /** Fresh code, keeping whatever the phone already delivered. */
  restart(): void;
  stop(): void;
};

let active: HandoffHost | null = null;

/**
 * Module scope, not per host. A phone re-claims with the code in its URL on
 * every socket open, so a host that was torn down and rebuilt would score those
 * retries as wrong guesses and burn the lockout on a code the user is still
 * looking at.
 */
let retired: string[] = [];

function broadcast(offer: HandoffOffer | null, ack?: HandoffAck): void {
  if (!hasTauri) return;
  const msg: HandoffServerMessage = { t: HANDOFF_MSG, proto: HANDOFF_PROTO, offer };
  if (ack) msg.ack = ack;
  void invoke("remote_ws_broadcast", { payload: JSON.stringify(msg) }).catch(() => {});
}

export function startHandoffHost(opts: HandoffHostOptions): HandoffHost {
  active?.stop();

  let session: HandoffSession = createHandoffSession(opts.steps, { ttlMs: opts.ttlMs });
  let stopped = false;
  let queue: Promise<void> = Promise.resolve();
  let timer = 0;
  const unsubs: UnlistenFn[] = [];

  function publish(ack?: HandoffAck): void {
    if (stopped) return;
    const offer = session.offer();
    broadcast(offer, ack);
    opts.onChange(offer, session.token);
  }

  function retire(token: string): void {
    retired = [token, ...retired.filter((t) => t !== token)].slice(0, RETIRED_KEEP);
  }

  function remint(): void {
    const prev = session.offer();
    retire(session.token);
    session = createHandoffSession(prev.pending, {
      ttlMs: opts.ttlMs,
      initialDone: prev.done,
    });
  }

  async function apply(payload: HandoffPayload): Promise<void> {
    let timeout = 0;
    try {
      await Promise.race([
        Promise.resolve(opts.onPayload(payload)),
        new Promise<never>((_, rej) => {
          timeout = window.setTimeout(() => rej(new Error("apply timed out")), APPLY_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function settle(nonce: string, ok: boolean, reason: HandoffReject | null): void {
    if (session.needsRemint()) remint();
    publish({ nonce, ok, reason });
  }

  async function handle(clientId: number, msg: HandoffClientMessage): Promise<void> {
    if (stopped) return;
    if (msg.proto !== HANDOFF_PROTO) {
      settle(msg.nonce, false, "badProto");
      return;
    }

    const cmd = msg.cmd;
    if (cmd.kind === "hello") {
      settle(msg.nonce, true, null);
      return;
    }
    // A phone retrying with the code it was given must read as expired, not as
    // a wrong guess, or its retries burn the lockout budget on the new offer.
    if (retired.includes(cmd.token)) {
      settle(msg.nonce, false, "expired");
      return;
    }
    if (cmd.kind === "claim") {
      const r = session.claim(clientId, cmd.token);
      settle(msg.nonce, r.ok, r.ok ? null : r.reason);
      return;
    }
    if (cmd.kind === "abandon") {
      const r = session.abandon(clientId, cmd.token);
      settle(msg.nonce, r.ok, r.ok ? null : r.reason);
      return;
    }

    const check = session.checkDeliver(clientId, cmd.token, cmd.payload);
    if (!check.ok) {
      settle(msg.nonce, false, check.reason);
      return;
    }
    try {
      await apply(cmd.payload);
    } catch {
      settle(msg.nonce, false, "applyFailed");
      return;
    }
    if (stopped) return;
    session.commitDeliver(cmd.payload);
    settle(msg.nonce, true, null);
  }

  function enqueue(clientId: number, msg: HandoffClientMessage): void {
    queue = queue.then(() => handle(clientId, msg)).catch(() => {});
  }

  if (hasTauri) {
    void listen<{ clientId: number; raw: string }>("remote://cmd", (e) => {
      const raw = e.payload?.raw;
      // Every remote frame lands here, including latency-sensitive nav. Cheap
      // reject before paying for a JSON.parse.
      if (!raw || !raw.includes(HANDOFF_MSG)) return;
      const env = parseHandoffEnvelope(raw);
      if (!env) return;
      if (!env.ok) {
        settle(env.nonce, false, "badPayload");
        return;
      }
      enqueue(e.payload.clientId, env.msg);
    }).then((u) => {
      if (stopped) u();
      else unsubs.push(u);
    });

    void listen<{ action: string; clientId: number }>("remote://client", (e) => {
      const p = e.payload;
      if (!p) return;
      if (p.action === "join") {
        publish();
        return;
      }
      if (p.action === "leave" && session.releaseClient(p.clientId)) publish();
    }).then((u) => {
      if (stopped) u();
      else unsubs.push(u);
    });

    timer = window.setInterval(() => {
      if (!session.needsRemint()) return;
      remint();
      publish();
    }, 1000);
  }

  publish();

  const host: HandoffHost = {
    token: () => session.token,
    offer: () => session.offer(),
    restart() {
      if (stopped) return;
      remint();
      publish();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      retire(session.token);
      if (timer) window.clearInterval(timer);
      for (const u of unsubs) u();
      unsubs.length = 0;
      broadcast(null);
      if (active === host) active = null;
    },
  };
  active = host;
  return host;
}
