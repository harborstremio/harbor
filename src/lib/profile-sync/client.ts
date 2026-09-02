import { socialGet, socialPost } from "@/lib/social/client";
import { authToken, refreshTokenValue } from "@/lib/theme-auth";
import type { PushResponse, PushResult, PushWrite, SyncDoc, SyncStateResponse } from "./types";

/**
 * These paths hang off the authenticated themes API that socialGet/socialPost already
 * carry a bearer for. They deliberately do NOT use HARBOR_SYNC_BASE from
 * lib/config/endpoints: sync.harbor.site is the anonymous subtitle autosync crowd
 * database keyed on content hashes, it has no auth and no backup, and the name is a trap.
 */
const STATE_PATH = "/sync/v1/state";
const PUSH_PATH = "/sync/v1/push";

export type SyncArm = "ok" | "signed-out" | "no-refresh";

/**
 * The legacy theme-author sign in (theme-auth.ts registerAuthor/loginAuthor/recoverAuthor)
 * calls setSession with no refresh field, and refreshToken() bails when refresh is absent.
 * Such a device can never recover from a 401, and every existing sync caller in this app
 * swallows errors, so it would fail forever with no symptom. Refuse to arm instead.
 */
export function syncArm(): SyncArm {
  if (!authToken()) return "signed-out";
  if (!refreshTokenValue()) return "no-refresh";
  return "ok";
}

export function httpStatusOf(e: unknown): number {
  const s = (e as { status?: unknown } | null | undefined)?.status;
  return typeof s === "number" ? s : 0;
}

export function isRateLimited(e: unknown): boolean {
  return httpStatusOf(e) === 429;
}

export function isAuthFailure(e: unknown): boolean {
  const s = httpStatusOf(e);
  return s === 401 || s === 403;
}

/**
 * 422 and 413 mean the server looked at this batch and refused it. Retrying the identical
 * bytes can only fail identically, so these must never be treated as a network blip: that
 * is how one malformed or oversized section stalls every other section on the account
 * forever. The body names the offending key for the per-write cases.
 */
export function isRejection(e: unknown): boolean {
  const s = httpStatusOf(e);
  return s === 422 || s === 413;
}

export function rejectedKeyOf(e: unknown): string {
  const key = (e as { body?: { key?: unknown } } | null | undefined)?.body?.key;
  return typeof key === "string" ? key : "";
}

function asDoc(raw: unknown): SyncDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.key !== "string" || !d.key) return null;
  if (typeof d.rev !== "number" || !Number.isFinite(d.rev)) return null;
  return {
    key: d.key,
    rev: d.rev,
    at: typeof d.at === "string" ? d.at : "",
    value: d.value,
  };
}

function malformed(what: string): Error {
  return Object.assign(new Error(`sync: malformed ${what}`), { status: 502 });
}

/**
 * A 200 is not proof of an answer. A captive portal, a Cloudflare interstitial, an nginx
 * cached page and a half deployed endpoint all reply 200 with a body that is not this
 * document, and socialGet swallows a JSON parse failure into {}. Coercing that to
 * `docs: []` reads as "the account holds nothing", which marks every registered key
 * hydrated, disarms the one gate protecting a cold device, pushes at baseRev 0 and
 * re-seeds a household that already has syncIds. A missing docs array is a failed pull.
 */
function asState(raw: unknown): SyncStateResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(r.docs)) throw malformed("state");
  const docs: SyncDoc[] = [];
  for (const entry of r.docs) {
    const doc = asDoc(entry);
    if (doc) docs.push(doc);
  }
  return {
    rev: typeof r.rev === "number" ? r.rev : 0,
    serverTime: typeof r.serverTime === "string" ? r.serverTime : "",
    docs,
  };
}

function asResult(raw: unknown): PushResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key : undefined;
  if (r.ok === true) {
    if (typeof r.rev !== "number") return null;
    return key ? { key, ok: true, rev: r.rev } : { ok: true, rev: r.rev };
  }
  const current = asDoc(r.current);
  if (!current) return null;
  return key ? { key, ok: false, current } : { ok: false, current };
}

function asPushResponse(raw: unknown): PushResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(r.results)) throw malformed("push response");
  const results: PushResult[] = [];
  for (const entry of r.results) {
    const parsed = asResult(entry);
    if (parsed) results.push(parsed);
  }
  return {
    serverTime: typeof r.serverTime === "string" ? r.serverTime : "",
    results,
  };
}

export function resultKey(result: PushResult): string {
  if (result.key) return result.key;
  return result.ok ? "" : result.current.key;
}

export async function fetchSyncState(signal?: AbortSignal): Promise<SyncStateResponse> {
  return asState(await socialGet<unknown>(STATE_PATH, signal));
}

export async function pushSyncWrites(writes: PushWrite[]): Promise<PushResponse> {
  return asPushResponse(await socialPost<unknown>(PUSH_PATH, { writes }));
}
