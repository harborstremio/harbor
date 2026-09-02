import { currentAuthor } from "@/lib/theme-auth";
import {
  fetchSyncState,
  isAuthFailure,
  isRateLimited,
  isRejection,
  pushSyncWrites,
  rejectedKeyOf,
  resultKey,
  syncArm,
} from "./client";
import { ACCOUNT_KEY, removeKey } from "./keys";
import { knownSyncIds, localIdFor } from "./id-map";
import { clearAllParked, clearParked, park } from "./parked";
import { MAX_PUSH_BYTES, MAX_WRITES_PER_PUSH, byteLength, sectionLimit } from "./limits";
import { clearQueue, dropFromQueue, enqueueDirty, queueEntries, queueSize, queuedSince } from "./queue";
import {
  bindAccount,
  boundAccount,
  clearRevState,
  isHydrated,
  markHydrated,
  markPulledNow,
  markSent,
  matchesSent,
  revOf,
  setRev,
} from "./revs";
import { clearRosterSectionState, seedRosterFromLocal, setRosterFirstPull } from "./roster-section";
import { rosterWired } from "./roster-store";
import {
  applyRank,
  docKey,
  isAccountSection,
  isStructurallyEmpty,
  parseDocKey,
  registeredAccountSections,
  registeredProfileSections,
  sectionAdapter,
} from "./sections";
import { patchSyncStatus } from "./status";
import {
  ACCOUNT_SCOPE,
  type PushWrite,
  type SectionKey,
  type SyncDoc,
  type SyncErrorKind,
} from "./types";

const RATE_LIMIT_BACKOFF_MS = 60000;
const REJECT_BACKOFF_MS = 60_000;

export type PullOutcome = { ok: true; firstPull: boolean } | { ok: false; reason: SyncErrorKind };
export type PushOutcome =
  | { ok: true; accepted: number; rejected: number }
  | { ok: false; reason: SyncErrorKind };

let rateLimitedUntil = 0;

export function rateLimitRemaining(now: number): number {
  return Math.max(0, rateLimitedUntil - now);
}

export function syncAccountId(): string {
  return currentAuthor()?.id ?? "";
}

export function resetSyncState(): void {
  clearRevState();
  clearQueue();
  clearAllParked();
  clearRosterSectionState();
  removeKey(ACCOUNT_KEY);
  patchSyncStatus({
    everPulled: false,
    queued: 0,
    queuedSince: null,
    lastPullAt: 0,
    lastPushAt: 0,
    lastError: null,
  });
}

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value ?? null) ?? "null";
  } catch {
    return "";
  }
}

function resolveProfileId(scope: string, section: SectionKey): string | null {
  if (isAccountSection(section)) return scope === ACCOUNT_SCOPE ? "" : null;
  return localIdFor(scope);
}

function rankOf(key: string): number {
  const parsed = parseDocKey(key);
  return parsed ? applyRank(parsed.section) : Number.MAX_SAFE_INTEGER;
}

function refreshQueueStatus(): void {
  patchSyncStatus({ queued: queueSize(), queuedSince: queuedSince() });
}

function classify(e: unknown): SyncErrorKind {
  if (isRateLimited(e)) return "rate-limited";
  if (isAuthFailure(e)) return "auth";
  if (isRejection(e)) return "server";
  return "network";
}

function safeRead(read: (profileId: string) => unknown, profileId: string): unknown {
  try {
    return read(profileId);
  } catch {
    return undefined;
  }
}

/**
 * `adopting` is the first pull against an account. That pass replaces every local section
 * with the server's copy in one go, and it is the single highest volume overwrite in the
 * design: a user who has customised home, anime, catalogs and services over months loses
 * all of it the moment they sign in. parked.ts promises the loser is kept so it can be
 * re-pushed once, but that promise was only implemented for a rejected push, which is the
 * rarer case and the one with less at stake. Adoption parks too.
 */
function applyDocs(docs: SyncDoc[], adopting: boolean): Set<string> {
  const applied = new Set<string>();
  const sorted = [...docs].sort((a, b) => rankOf(a.key) - rankOf(b.key));
  for (const doc of sorted) {
    const parsed = parseDocKey(doc.key);
    if (!parsed) continue;
    const adapter = sectionAdapter(parsed.section);
    if (!adapter) continue;
    const profileId = resolveProfileId(parsed.scope, parsed.section);
    if (profileId == null) continue;
    const mine = adapter.merge ? undefined : safeRead(adapter.read, profileId);
    if (
      mine !== undefined &&
      revOf(doc.key) > 0 &&
      revOf(doc.key) === doc.rev &&
      !isStructurallyEmpty(mine) &&
      !matchesSent(doc.key, serialize(mine))
    ) {
      markHydrated(doc.key);
      continue;
    }
    const before = adopting && !adapter.merge ? safeRead(adapter.read, profileId) : undefined;
    const next = adapter.merge ? adapter.merge(adapter.read(profileId), doc.value) : doc.value;
    let outcome: void | boolean;
    try {
      outcome = adapter.write(profileId, next);
    } catch {
      continue;
    }
    if (outcome === false) continue;
    if (
      before !== undefined &&
      !isStructurallyEmpty(before) &&
      serialize(before) !== serialize(doc.value)
    ) {
      park(doc.key, before, doc.rev);
    }
    setRev(doc.key, doc.rev);
    // Stamped with the SERVER value, not the applied one. A replace section now matches
    // and will not be re-pushed; a merge section deliberately does not match, so the
    // merged result goes back up on the next flush.
    markSent(doc.key, serialize(doc.value));
    applied.add(doc.key);
  }
  return applied;
}

/**
 * A doc that arrived but could not be applied stays UNHYDRATED, so this device is never
 * allowed to push over a section it failed to adopt. Absence is different: a full state
 * GET is authoritative that the server holds nothing for that key, so it counts.
 */
function markHydrationAfterPull(docs: SyncDoc[], applied: Set<string>): void {
  const seen = new Set(docs.map((d) => d.key));
  for (const key of applied) markHydrated(key);
  for (const section of registeredAccountSections()) {
    const key = docKey(section, ACCOUNT_SCOPE);
    if (!seen.has(key)) markHydrated(key);
  }
  for (const section of registeredProfileSections()) {
    for (const syncId of knownSyncIds()) {
      const key = docKey(section, syncId);
      if (!seen.has(key)) markHydrated(key);
    }
  }
}

/**
 * The roster is queued after every pull rather than only when it changed. prepareWrites
 * drops it again when it already matches the server, so the cost of being wrong is one
 * map lookup, and the cost of being right is that a newly seeded or newly adopted
 * household reaches the account without waiting for the user to touch something.
 */
function settleRoster(docs: SyncDoc[]): void {
  if (!sectionAdapter("profiles")) return;
  const key = docKey("profiles", ACCOUNT_SCOPE);
  if (!docs.some((d) => d.key === key)) {
    seedRosterFromLocal();
    enqueueDirty(key);
    return;
  }
  // The account already holds a roster. Pushing ours before the apply path can adopt
  // theirs is the "second device overwrites the account" move, so stay read only.
  if (rosterWired()) enqueueDirty(key);
}

export async function runPull(signal?: AbortSignal): Promise<PullOutcome> {
  const arm = syncArm();
  if (arm !== "ok") {
    patchSyncStatus({ armed: false, phase: arm === "signed-out" ? "signed-out" : "no-refresh" });
    return { ok: false, reason: "auth" };
  }
  const account = syncAccountId();
  if (!account) {
    patchSyncStatus({ armed: false, phase: "signed-out" });
    return { ok: false, reason: "auth" };
  }
  const bound = boundAccount();
  const firstPull = bound !== account;
  patchSyncStatus({
    armed: true,
    rosterWired: rosterWired(),
    phase: firstPull ? "first-pull" : "pulling",
  });

  let state;
  try {
    state = await fetchSyncState(signal);
  } catch (e) {
    const reason = classify(e);
    if (reason === "rate-limited") rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    patchSyncStatus({ phase: firstPull ? "first-pull-failed" : "idle", lastError: reason });
    return { ok: false, reason };
  }

  // AFTER the request, never before it. This used to run at the top of runPull on every
  // attempt while the account was unbound, and resetSyncState clears the queue, the
  // parked copies and the tombstones. A TV that could not reach the server therefore
  // deleted the user's offline edits every eight seconds, on a pull that never happened,
  // and a profile deleted offline lost its tombstone so the delete never propagated.
  //
  // Only an account SWITCH discards pending work, because that work belongs to somebody
  // else's data. Binding an account for the first time keeps it: those are this user's
  // own unsent edits, and clearing rev bookkeeping is enough.
  if (firstPull) {
    if (bound) resetSyncState();
    else clearRevState();
    setRosterFirstPull(true);
  }

  const applied = applyDocs(state.docs, firstPull);
  // settleRoster before markHydrationAfterPull: the syncIds are minted inside settleRoster
  // and hydration is computed from knownSyncIds(), so the old order left every
  // profile-scoped key unhydrated on a brand new account and withheld the user's very
  // first customisation until the next scheduled pull.
  settleRoster(state.docs);
  markHydrationAfterPull(state.docs, applied);
  bindAccount(account);
  markPulledNow();
  if (firstPull) setRosterFirstPull(false);
  patchSyncStatus({
    phase: "idle",
    everPulled: true,
    rosterWired: rosterWired(),
    lastPullAt: Date.now(),
    lastError: null,
  });
  return { ok: true, firstPull };
}

type Prepared = {
  write: PushWrite;
  serialized: string;
  section: SectionKey;
  profileId: string;
  bytes?: number;
};

function prepareWrites(): Prepared[] {
  const out: Prepared[] = [];
  for (const entry of queueEntries()) {
    const key = entry.key;
    const parsed = parseDocKey(key);
    if (!parsed) {
      dropFromQueue(key);
      continue;
    }
    // THE HYDRATION GATE. No push for a section this process has not pulled.
    if (!isHydrated(key)) continue;
    const adapter = sectionAdapter(parsed.section);
    if (!adapter) continue;
    const profileId = resolveProfileId(parsed.scope, parsed.section);
    if (profileId == null) continue;
    const baseRev = revOf(key);
    if (entry.clear) {
      out.push({
        write: { key, baseRev, clear: true },
        serialized: "",
        section: parsed.section,
        profileId,
      });
      continue;
    }
    let value: unknown;
    try {
      value = adapter.read(profileId);
    } catch {
      dropFromQueue(key);
      continue;
    }
    // Held, NOT dropped. An adapter reading empty is almost always a store that has not
    // loaded yet, so sending it would wipe the account. But deleting the queue entry
    // threw the user's edit away and let the next pull re-apply the server's older doc
    // over it, so the edit was not merely skipped, it was reverted on a timer. Holding
    // costs a pending entry that clears itself as soon as the store has real content.
    // A deliberate reset to default is a CLEAR and must come through markSectionCleared;
    // an adapter cannot express it by writing an empty value.
    if (isStructurallyEmpty(value)) continue;
    const serialized = serialize(value);
    if (matchesSent(key, serialized)) {
      dropFromQueue(key);
      continue;
    }
    const bytes = byteLength(serialized);
    if (bytes > sectionLimit(parsed.section)) {
      park(key, value, revOf(key));
      dropFromQueue(key);
      continue;
    }
    out.push({
      write: { key, baseRev, value },
      serialized,
      section: parsed.section,
      profileId,
      bytes,
    });
  }
  return capPush(out);
}

/**
 * The server refuses a push carrying more than MAX_WRITES_PER_PUSH writes or
 * MAX_PUSH_BYTES of value, and it refuses the WHOLE batch rather than the offending
 * write. An uncapped client therefore sends an over-limit batch, takes a 413, retries
 * the identical batch on the next tick and never drains: every section behind it is
 * stalled for as long as the account stays dirty. Sending a prefix that fits leaves the
 * rest queued for the next pass instead.
 */
function capPush(all: Prepared[]): Prepared[] {
  const out: Prepared[] = [];
  let bytes = 0;
  for (const entry of all) {
    if (out.length >= MAX_WRITES_PER_PUSH) break;
    const next = bytes + (entry.bytes ?? 0);
    if (out.length > 0 && next > MAX_PUSH_BYTES) break;
    out.push(entry);
    bytes = next;
  }
  return out;
}

function onRejected(prepared: Prepared, current: SyncDoc): void {
  const adapter = sectionAdapter(prepared.section);
  if (!adapter) return;
  const key = prepared.write.key;
  const mine = "value" in prepared.write ? prepared.write.value : undefined;
  const next = adapter.merge ? adapter.merge(adapter.read(prepared.profileId), current.value) : current.value;
  let outcome: void | boolean;
  try {
    outcome = adapter.write(prepared.profileId, next);
  } catch {
    dropFromQueue(key);
    return;
  }
  if (outcome === false) {
    // Withhold the rev so the next pull retries the apply, but drop the key so this
    // does not become a losing push every five seconds forever.
    dropFromQueue(key);
    return;
  }
  setRev(key, current.rev);
  markSent(key, serialize(current.value));
  dropFromQueue(key);
  if (prepared.section === "profiles" || adapter.merge) {
    enqueueDirty(key);
    return;
  }
  // A rejected CLEAR has no value of its own. Parking the undefined would write null back
  // into the adapter if the user ever chose "restore my version", wiping the section.
  if (mine === undefined) return;
  park(key, mine, current.rev);
}

export async function runPush(): Promise<PushOutcome> {
  const arm = syncArm();
  if (arm !== "ok") {
    patchSyncStatus({ armed: false, phase: arm === "signed-out" ? "signed-out" : "no-refresh" });
    return { ok: false, reason: "auth" };
  }
  if (Date.now() < rateLimitedUntil) return { ok: false, reason: "rate-limited" };

  const prepared = prepareWrites();
  refreshQueueStatus();
  if (prepared.length === 0) return { ok: true, accepted: 0, rejected: 0 };

  patchSyncStatus({ phase: "pushing" });
  let response;
  try {
    response = await pushSyncWrites(prepared.map((p) => p.write));
  } catch (e) {
    const reason = classify(e);
    if (reason === "rate-limited") rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    if (reason === "server") {
      // The batch was refused whole. Park and drop the write the server named so the rest
      // can drain; when it named none, drop the largest so the batch shrinks every pass
      // instead of resending the same refused bytes forever.
      const named = rejectedKeyOf(e);
      const victim =
        prepared.find((entry) => entry.write.key === named) ??
        prepared.reduce((worst, entry) => ((entry.bytes ?? 0) > (worst.bytes ?? 0) ? entry : worst));
      if (victim) {
        const mine = "value" in victim.write ? victim.write.value : undefined;
        if (mine !== undefined) park(victim.write.key, mine, revOf(victim.write.key));
        dropFromQueue(victim.write.key);
        refreshQueueStatus();
      }
      rateLimitedUntil = Date.now() + REJECT_BACKOFF_MS;
    }
    patchSyncStatus({ phase: "idle", lastError: reason });
    return { ok: false, reason };
  }

  const byKey = new Map(prepared.map((p) => [p.write.key, p]));
  let accepted = 0;
  let rejected = 0;
  // The server is not built yet. If it echoes results positionally without a key, fall
  // back to the request order rather than silently re-pushing every accepted write.
  for (const [index, result] of response.results.entries()) {
    const entry = byKey.get(resultKey(result)) ?? prepared[index];
    if (!entry) continue;
    const key = entry.write.key;
    if (result.ok) {
      setRev(key, result.rev);
      if (entry.serialized) markSent(key, entry.serialized);
      clearParked(key);
      dropFromQueue(key);
      accepted += 1;
      continue;
    }
    rejected += 1;
    onRejected(entry, result.current);
  }
  patchSyncStatus({ phase: "idle", lastPushAt: Date.now(), lastError: null });
  refreshQueueStatus();
  return { ok: true, accepted, rejected };
}
