import { activeProfileId } from "@/lib/active-profile-id";
import { subscribeAuthor } from "@/lib/theme-auth";
import { rateLimitRemaining, runPull, runPush } from "./engine";
import { syncIdFor } from "./id-map";
import { clearParked, readParked } from "./parked";
import { enqueueClear, enqueueDirty, queueSize, queuedSince } from "./queue";
import { lastPullAt } from "./revs";
import { registerRosterSection } from "./roster-section";
import { docKey, isAccountSection, sectionAdapter } from "./sections";
import { patchSyncStatus } from "./status";
import { ACCOUNT_SCOPE, type SectionKey } from "./types";

/**
 * 2500ms is chosen against three real numbers rather than taste: a row drag emits one
 * mutation per step, nginx sits at 6r/m on some routes, and the existing ratings push
 * already self throttles at 1100ms.
 */
const DEBOUNCE_MS = 2500;
const PUSH_FLOOR_MS = 5000;
const PULL_INTERVAL_MS = 15 * 60000;
const FOREGROUND_STALE_MS = 5 * 60000;
const PULL_BACKOFF_MS = [8000, 30000, 120000, 600000];

let started = false;
let busy = false;
let flushTimer = 0;
let pullTimer = 0;
let lastPushAt = 0;
let pullFailures = 0;
const cleanups: Array<() => void> = [];

function refreshQueueStatus(): void {
  patchSyncStatus({ queued: queueSize(), queuedSince: queuedSince() });
}

export function scheduleFlush(delay = DEBOUNCE_MS): void {
  if (!started) return;
  const now = Date.now();
  const floor = Math.max(0, lastPushAt + PUSH_FLOOR_MS - now);
  const wait = Math.max(delay, floor, rateLimitRemaining(now));
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), wait);
}

async function flush(): Promise<void> {
  if (busy) {
    scheduleFlush(1000);
    return;
  }
  busy = true;
  try {
    const outcome = await runPush();
    if (outcome.ok) lastPushAt = Date.now();
    else if (outcome.reason === "network") scheduleFlush(30000);
  } finally {
    busy = false;
    refreshQueueStatus();
  }
}

/**
 * A flush on pagehide cannot be awaited, so the request may die with the process. That is
 * why the queue is persisted: the write is not lost, it goes up on next launch.
 */
export function flushSyncNow(): void {
  window.clearTimeout(flushTimer);
  if (rateLimitRemaining(Date.now()) > 0) return;
  void flush();
}

function schedulePull(delay: number): void {
  if (!started) return;
  window.clearTimeout(pullTimer);
  pullTimer = window.setTimeout(() => void pull(), delay);
}

async function pull(): Promise<void> {
  if (busy) {
    schedulePull(2000);
    return;
  }
  busy = true;
  let ok = false;
  let reason: string | null = null;
  try {
    const outcome = await runPull();
    ok = outcome.ok;
    if (!outcome.ok) reason = outcome.reason ?? "network";
  } finally {
    busy = false;
  }
  if (ok) {
    pullFailures = 0;
    // A6 reconnect order: pull first, then push only what still differs.
    if (queueSize() > 0) scheduleFlush(0);
    schedulePull(PULL_INTERVAL_MS);
    return;
  }
  if (reason === "auth") {
    schedulePull(PULL_INTERVAL_MS);
    return;
  }
  const step = Math.min(pullFailures, PULL_BACKOFF_MS.length - 1);
  pullFailures += 1;
  schedulePull(PULL_BACKOFF_MS[step]);
}

export function requestSyncPull(): void {
  schedulePull(0);
}

function scopeFor(section: SectionKey, profileId?: string): string | null {
  if (isAccountSection(section)) return ACCOUNT_SCOPE;
  const local = profileId || activeProfileId();
  if (!local || local === "default") return null;
  return syncIdFor(local);
}

/**
 * A profile with no syncId yet has nothing to push to, and silently dropping the mark is
 * correct: the roster push issues the syncId, and the section goes up on the next
 * mutation after that.
 */
export function markSectionDirty(section: SectionKey, profileId?: string): void {
  const scope = scopeFor(section, profileId);
  if (!scope) return;
  enqueueDirty(docKey(section, scope));
  refreshQueueStatus();
  scheduleFlush();
}

export function markSectionCleared(section: SectionKey, profileId?: string): void {
  const scope = scopeFor(section, profileId);
  if (!scope) return;
  enqueueClear(docKey(section, scope));
  refreshQueueStatus();
  scheduleFlush();
}

/**
 * A3 step 3. The parked value is written back locally so the screen changes at once, then
 * queued at the fresh baseRev the rejection taught us, so this time it wins cleanly.
 */
export function restoreParkedSection(section: SectionKey, profileId?: string): boolean {
  const scope = scopeFor(section, profileId);
  if (!scope) return false;
  const key = docKey(section, scope);
  const parked = readParked(key);
  const adapter = sectionAdapter(section);
  if (!parked || !adapter) return false;
  try {
    adapter.write(profileId || activeProfileId(), parked.value);
  } catch {
    return false;
  }
  clearParked(key);
  enqueueDirty(key);
  refreshQueueStatus();
  scheduleFlush(0);
  return true;
}

export function startProfileSync(): () => void {
  if (started) return stopProfileSync;
  started = true;
  registerRosterSection();
  refreshQueueStatus();

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      flushSyncNow();
      return;
    }
    if (Date.now() - lastPullAt() > FOREGROUND_STALE_MS) schedulePull(0);
  };
  const onHide = () => flushSyncNow();
  const onProfileChanged = () => schedulePull(0);
  const offAuthor = subscribeAuthor(() => schedulePull(0));

  window.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("harbor:active-profile-changed", onProfileChanged);
  cleanups.push(
    () => window.removeEventListener("visibilitychange", onVisibility),
    () => window.removeEventListener("pagehide", onHide),
    () => window.removeEventListener("harbor:active-profile-changed", onProfileChanged),
    offAuthor,
  );

  schedulePull(0);
  return stopProfileSync;
}

export function stopProfileSync(): void {
  if (!started) return;
  started = false;
  window.clearTimeout(flushTimer);
  window.clearTimeout(pullTimer);
  for (const fn of cleanups.splice(0)) fn();
}
