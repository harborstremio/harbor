import type { BridgeOutcome } from "./fetch-bridge-stats";

const DIRECT_FAIL_LIMIT = 2;
const DIRECT_FAIL_DECAY_MS = 60000;

const DIRECT_HOSTS = new Set([
  "v3-cinemeta.strem.io",
  "api.ani.zip",
  "anime-kitsu.strem.fun",
  "kitsu.io",
  "api.themoviedb.org",
  "graphql.anilist.co",
]);

const directFailures = new Map<string, { count: number; at: number }>();

export function allowDirectHost(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return;
    DIRECT_HOSTS.add(parsed.hostname);
  } catch {}
}

export function isDirectHostDemoted(host: string, now = Date.now()): boolean {
  const entry = directFailures.get(host);
  if (!entry) return false;
  if (now - entry.at >= DIRECT_FAIL_DECAY_MS) {
    directFailures.delete(host);
    return false;
  }
  return entry.count >= DIRECT_FAIL_LIMIT;
}

export function noteDirectFailure(host: string, now = Date.now()): void {
  const entry = directFailures.get(host);
  const count = entry && now - entry.at < DIRECT_FAIL_DECAY_MS ? entry.count + 1 : 1;
  directFailures.set(host, { count, at: now });
}

export function clearDirectFailures(host: string): void {
  directFailures.delete(host);
}

export function directHostFor(url: string, now = Date.now()): string | null {
  try {
    const host = new URL(url).hostname;
    if (!DIRECT_HOSTS.has(host)) return null;
    if (isDirectHostDemoted(host, now)) return null;
    return host;
  } catch {
    return null;
  }
}

export function resetDirectHostPolicy(): void {
  directFailures.clear();
}

export type DirectFailure = {
  callerAborted: boolean;
  timedOut: boolean;
  cancelled: boolean;
  idempotent: boolean;
};

export type DirectFailureVerdict = {
  action: "rethrow" | "fallback" | "giveUp";
  outcome: BridgeOutcome;
  demote: boolean;
};

export function classifyDirectFailure(failure: DirectFailure): DirectFailureVerdict {
  if (failure.callerAborted) return { action: "rethrow", outcome: "abort", demote: false };
  if (failure.timedOut) {
    return failure.idempotent
      ? { action: "fallback", outcome: "timeout", demote: true }
      : { action: "giveUp", outcome: "timeout", demote: true };
  }
  if (failure.cancelled) return { action: "rethrow", outcome: "abort", demote: false };
  return { action: "fallback", outcome: "error", demote: true };
}
