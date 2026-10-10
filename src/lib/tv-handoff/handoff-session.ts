import { mintHandoffId, mintHandoffToken } from "./handoff-code";
import {
  HANDOFF_MAX_FAILED_CLAIMS,
  HANDOFF_TTL_MS,
  type HandoffOffer,
  type HandoffOfferState,
  type HandoffPayload,
  type HandoffResult,
  type HandoffStepId,
} from "./handoff-protocol";

export type HandoffSessionOptions = {
  ttlMs?: number;
  maxFailedClaims?: number;
  /** Carried across a remint so the TV's ticked lines survive a new code. */
  initialDone?: readonly HandoffStepId[];
  now?: () => number;
  mintToken?: () => string;
  mintId?: () => string;
};

export type HandoffSession = {
  /** Never broadcast. Lives on the TV screen, in the QR, and in the phone's URL. */
  token: string;
  offerId: string;
  expiresAt: number;
  offer(): HandoffOffer;
  needsRemint(): boolean;
  claim(clientId: number, token: string): HandoffResult;
  /** Validates without mutating, so a failed apply does not consume the step. */
  checkDeliver(clientId: number, token: string, payload: HandoffPayload): HandoffResult;
  commitDeliver(payload: HandoffPayload): void;
  abandon(clientId: number, token: string): HandoffResult;
  /** Socket dropped. Frees the binding so a reload can re-claim with the same code. */
  releaseClient(clientId: number): boolean;
};

export function createHandoffSession(
  steps: readonly HandoffStepId[],
  opts: HandoffSessionOptions = {},
): HandoffSession {
  const now = opts.now ?? (() => Date.now());
  const ttlMs = opts.ttlMs ?? HANDOFF_TTL_MS;
  const maxFailed = opts.maxFailedClaims ?? HANDOFF_MAX_FAILED_CLAIMS;

  const token = (opts.mintToken ?? mintHandoffToken)();
  const offerId = (opts.mintId ?? mintHandoffId)();
  const expiresAt = now() + ttlMs;

  let done: HandoffStepId[] = [...new Set(opts.initialDone ?? [])];
  let pending: HandoffStepId[] = [...new Set(steps)].filter((s) => !done.includes(s));
  let bound: number | null = null;
  let failed = 0;
  let dead = false;

  const isExpired = () => now() >= expiresAt;
  const isComplete = () => pending.length === 0;

  function state(): HandoffOfferState {
    if (isComplete()) return "complete";
    if (dead || isExpired()) return "expired";
    return bound == null ? "open" : "claimed";
  }

  /** A wrong token is an oracle. Count it, and burn the offer once it is abused. */
  function badToken(): HandoffResult {
    failed += 1;
    if (failed >= maxFailed) {
      dead = true;
      return { ok: false, reason: "lockedOut" };
    }
    return { ok: false, reason: "badToken" };
  }

  function gate(clientId: number, given: string, needBinding: boolean): HandoffResult {
    if (dead) return { ok: false, reason: "lockedOut" };
    if (isExpired()) return { ok: false, reason: "expired" };
    if (given !== token) return badToken();
    if (!needBinding) return { ok: true };
    if (bound == null) return { ok: false, reason: "notBound" };
    if (bound !== clientId) return { ok: false, reason: "boundElsewhere" };
    return { ok: true };
  }

  return {
    token,
    offerId,
    expiresAt,

    offer(): HandoffOffer {
      return {
        offerId,
        state: state(),
        expiresAt,
        pending: [...pending],
        done: [...done],
      };
    },

    needsRemint: () => !isComplete() && (dead || isExpired()),

    claim(clientId, given) {
      const g = gate(clientId, given, false);
      if (!g.ok) return g;
      if (bound == null || bound === clientId) {
        bound = clientId;
        failed = 0;
        return { ok: true };
      }
      return { ok: false, reason: "boundElsewhere" };
    },

    checkDeliver(clientId, given, payload) {
      const g = gate(clientId, given, true);
      if (!g.ok) return g;
      if (done.includes(payload.step)) return { ok: false, reason: "stepDone" };
      if (!pending.includes(payload.step)) return { ok: false, reason: "stepUnknown" };
      return { ok: true };
    },

    commitDeliver(payload) {
      if (done.includes(payload.step)) return;
      pending = pending.filter((s) => s !== payload.step);
      done = [...done, payload.step];
    },

    abandon(clientId, given) {
      const g = gate(clientId, given, false);
      if (!g.ok) return g;
      if (bound === clientId) bound = null;
      return { ok: true };
    },

    releaseClient(clientId) {
      if (bound !== clientId) return false;
      bound = null;
      return true;
    },
  };
}
