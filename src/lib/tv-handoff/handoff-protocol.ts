/**
 * Wire contract for the TV setup hand-off.
 *
 * Rides the existing remote WebSocket without touching it. The Rust server
 * emits inbound text frames as `remote://cmd` to the host only, and fans
 * outbound frames to every connected client, so upstream is private and
 * downstream is public. Nothing here that travels downstream is a secret.
 */

export const HANDOFF_MSG = "harborSetup";
export const HANDOFF_PROTO = 1;

/** Matches the Trakt device flow's shape: long enough to finish, short enough to be safe. */
export const HANDOFF_TTL_MS = 10 * 60 * 1000;

/** Nothing has connected by now: the TV says why and moves focus to its own path. */
export const HANDOFF_STALL_MS = 45_000;

/** Wrong-token attempts before the offer is burned and reminted. */
export const HANDOFF_MAX_FAILED_CLAIMS = 8;

/** Query parameter the phone page reads the code from. */
export const HANDOFF_PARAM = "setup";

export type HandoffStepId = "tmdb" | "stremio" | "harbor";

export const HANDOFF_STEPS: readonly HandoffStepId[] = ["tmdb", "stremio", "harbor"];

/**
 * Phone to TV only. These carry credentials and must never appear in an
 * outbound frame.
 */
export type HandoffPayload =
  | { step: "tmdb"; key: string }
  | { step: "stremio"; authKey: string; label?: string | null }
  | { step: "harbor"; session: string; handle: string; refresh?: string | null };

export type HandoffOfferState = "open" | "claimed" | "complete" | "expired";

/**
 * TV to phone. Broadcast to every connected client, so it carries an opaque
 * correlation id rather than the token. The token exists only on the TV
 * screen, in the QR, and in the URL the phone opened.
 */
export type HandoffOffer = {
  offerId: string;
  state: HandoffOfferState;
  expiresAt: number;
  pending: HandoffStepId[];
  done: HandoffStepId[];
};

export type HandoffReject =
  | "badProto"
  | "noOffer"
  | "badToken"
  | "expired"
  | "notBound"
  | "boundElsewhere"
  | "stepUnknown"
  | "stepDone"
  | "lockedOut"
  | "badPayload"
  | "applyFailed";

export type HandoffAck = {
  nonce: string;
  ok: boolean;
  reason: HandoffReject | null;
};

export type HandoffServerMessage = {
  t: typeof HANDOFF_MSG;
  proto: number;
  offer: HandoffOffer | null;
  ack?: HandoffAck;
};

export type HandoffClientCommand =
  | { kind: "hello" }
  | { kind: "claim"; token: string }
  | { kind: "deliver"; token: string; payload: HandoffPayload }
  | { kind: "abandon"; token: string };

export type HandoffClientMessage = {
  t: typeof HANDOFF_MSG;
  proto: number;
  nonce: string;
  cmd: HandoffClientCommand;
};

export type HandoffResult = { ok: true } | { ok: false; reason: HandoffReject };

const TOKEN_RE = /^[0-9A-Z]{8,32}$/;
const NONCE_RE = /^[0-9A-Za-z]{4,32}$/;
const ID_RE = /^[0-9A-Za-z]{4,32}$/;

/** Alphanumeric only: the key is later spliced into TMDB query strings. */
const TMDB_KEY_RE = /^[A-Za-z0-9]{8,128}$/;
const AUTH_KEY_RE = /^[A-Za-z0-9._~+/=-]{8,512}$/;
const SESSION_RE = /^[A-Za-z0-9._~+/=-]{8,4096}$/;
/** Wider than a username field: existing Harbor handles carry dots and dashes. */
const HANDLE_RE = /^[a-zA-Z0-9._-]{2,40}$/;
const LABEL_MAX = 64;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown, re: RegExp): string | null {
  return typeof v === "string" && re.test(v) ? v : null;
}

/** Hostile input from the LAN. Every field is shape-checked and length-capped. */
export function parseHandoffPayload(v: unknown): HandoffPayload | null {
  if (!isRecord(v)) return null;
  if (v.step === "tmdb") {
    const key = str(v.key, TMDB_KEY_RE);
    return key ? { step: "tmdb", key } : null;
  }
  if (v.step === "stremio") {
    const authKey = str(v.authKey, AUTH_KEY_RE);
    if (!authKey) return null;
    const label =
      typeof v.label === "string" && v.label.length <= LABEL_MAX ? v.label : null;
    return { step: "stremio", authKey, label };
  }
  if (v.step === "harbor") {
    const session = str(v.session, SESSION_RE);
    const handle = str(v.handle, HANDLE_RE);
    if (!session || !handle) return null;
    return { step: "harbor", session, handle, refresh: str(v.refresh, SESSION_RE) };
  }
  return null;
}

function parseCommand(v: unknown): HandoffClientCommand | null {
  if (!isRecord(v)) return null;
  if (v.kind === "hello") return { kind: "hello" };
  const token = str(v.token, TOKEN_RE);
  if (!token) return null;
  if (v.kind === "claim") return { kind: "claim", token };
  if (v.kind === "abandon") return { kind: "abandon", token };
  if (v.kind === "deliver") {
    const payload = parseHandoffPayload(v.payload);
    return payload ? { kind: "deliver", token, payload } : null;
  }
  return null;
}

/**
 * A frame addressed to us whose command did not survive validation. Kept
 * distinct from "not our frame" so the host can answer `badPayload` instead of
 * dropping it, which used to leave the phone waiting out an ack timeout with no
 * idea that the shape of the value it typed was the problem.
 */
export type HandoffEnvelope =
  | { ok: true; msg: HandoffClientMessage }
  | { ok: false; nonce: string };

export function parseHandoffEnvelope(raw: string): HandoffEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.t !== HANDOFF_MSG) return null;
  if (typeof parsed.proto !== "number") return null;
  const nonce = str(parsed.nonce, NONCE_RE);
  if (!nonce) return null;
  const cmd = parseCommand(parsed.cmd);
  if (!cmd) return { ok: false, nonce };
  return { ok: true, msg: { t: HANDOFF_MSG, proto: parsed.proto, nonce, cmd } };
}

function parseStepList(v: unknown): HandoffStepId[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is HandoffStepId =>
    HANDOFF_STEPS.includes(s as HandoffStepId),
  );
}

function parseOffer(v: unknown): HandoffOffer | null {
  if (!isRecord(v)) return null;
  const offerId = str(v.offerId, ID_RE);
  const state = v.state;
  const valid =
    state === "open" || state === "claimed" || state === "complete" || state === "expired";
  if (!offerId || !valid || typeof v.expiresAt !== "number") return null;
  return {
    offerId,
    state,
    expiresAt: v.expiresAt,
    pending: parseStepList(v.pending),
    done: parseStepList(v.done),
  };
}

export function parseHandoffServerMessage(raw: string): HandoffServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.t !== HANDOFF_MSG) return null;
  if (typeof parsed.proto !== "number") return null;
  const offer = parsed.offer == null ? null : parseOffer(parsed.offer);
  const msg: HandoffServerMessage = { t: HANDOFF_MSG, proto: parsed.proto, offer };
  if (isRecord(parsed.ack)) {
    const nonce = str(parsed.ack.nonce, NONCE_RE);
    if (nonce && typeof parsed.ack.ok === "boolean") {
      const reason = typeof parsed.ack.reason === "string" ? parsed.ack.reason : null;
      msg.ack = { nonce, ok: parsed.ack.ok, reason: reason as HandoffReject | null };
    }
  }
  return msg;
}
