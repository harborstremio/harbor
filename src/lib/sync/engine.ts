import { SyncApi, SyncApiError, type PushDoc, type PushResult, type SyncDoc } from "./api";
import {
  KDF_ITERATIONS,
  decryptDoc,
  deriveKeys,
  encryptDoc,
  generateDataKey,
  generateKdfSalt,
  unwrapDataKey,
  wrapDataKey,
} from "./crypto";
import { fnv1a64, isSyncableKey } from "./keys";
import { mergeDoc } from "./merge";
import {
  buildAdoptionSummary,
  needsAdoptionPrompt,
  planAdoption,
  type AdoptionPlan,
  type AdoptionSummary,
  type SnapshotMap,
} from "./adopt";
import {
  clearSyncSession,
  loadSyncSession,
  saveSyncSession,
  syncEndpoint,
  type SyncSession,
} from "./session";

const STATE_KEY = "harbor.sync.state.v1";
const RELOAD_GUARD_KEY = "harbor.sync.reloaded.v1";
const PUSH_DEBOUNCE_MS = 3_000;
const RECONCILE_MS = 60_000;
const STARTUP_PULL_TIMEOUT_MS = 4_000;

type SyncState = {
  lastRev: number;
  docs: Record<string, { rev: number; hash: string }>;
};

type DirtyEntry = { updatedAt: number };

export type SyncStatus = {
  signedIn: boolean;
  email: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
  /** Set while a first sign-in waits for the user to choose a merge strategy. */
  pendingAdoption: AdoptionSummary | null;
};

function localStorageOrNull(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function sessionStorageOrNull(): Storage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

function emptyState(): SyncState {
  return { lastRev: 0, docs: {} };
}

function loadState(): SyncState {
  try {
    const raw = localStorageOrNull()?.getItem(STATE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("lastRev" in parsed) || !("docs" in parsed))
      return emptyState();
    if (
      typeof parsed.lastRev !== "number" ||
      !parsed.docs ||
      typeof parsed.docs !== "object" ||
      Array.isArray(parsed.docs)
    ) {
      return emptyState();
    }

    const docs: SyncState["docs"] = {};
    for (const [key, value] of Object.entries(parsed.docs)) {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !("rev" in value) ||
        !("hash" in value) ||
        typeof value.rev !== "number" ||
        typeof value.hash !== "string"
      ) {
        continue;
      }
      docs[key] = { rev: value.rev, hash: value.hash };
    }

    return { lastRev: parsed.lastRev, docs };
  } catch {
    return emptyState();
  }
}

function saveState(): void {
  try {
    localStorageOrNull()?.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Sync resumes from the server if local state persistence is unavailable.
  }
}

function clearState(): void {
  state = emptyState();
  try {
    localStorageOrNull()?.removeItem(STATE_KEY);
  } catch {
    // Sync resumes from the server if local state persistence is unavailable.
  }
}

function storedValue(key: string): string | null {
  try {
    return localStorageOrNull()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function valueHash(value: string | null): string {
  return fnv1a64(value ?? "");
}

let session = loadSyncSession();
let state = loadState();
let status: SyncStatus = {
  signedIn: session !== null,
  email: session?.email ?? null,
  syncing: false,
  lastSyncAt: null,
  error: null,
  pendingAdoption: null,
};
const statusSubscribers = new Set<() => void>();
const dirty = new Map<string, DirtyEntry>();
let suppressWrites = 0;
let storagePatched = false;
let watchersStarted = false;
let debounceTimer: number | null = null;
let reconcileTimer: number | null = null;
let syncPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

type PendingAdoption = {
  session: SyncSession;
  rev: number;
  docs: SyncDoc[];
  remote: SnapshotMap;
};
let pendingAdoption: PendingAdoption | null = null;

function updateStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  for (const subscriber of statusSubscribers) subscriber();
}

function markDirty(key: string): void {
  if (session && isSyncableKey(key)) dirty.set(key, { updatedAt: Date.now() });
}

function writeStoredValue(key: string, value: string | null): void {
  const storage = localStorageOrNull();
  if (!storage) return;

  suppressWrites += 1;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } finally {
    suppressWrites -= 1;
  }
}

function patchStorage(): void {
  if (storagePatched || typeof Storage === "undefined") return;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
    originalSetItem.call(this, key, value);
    if (suppressWrites === 0) markDirty(key);
  };
  Storage.prototype.removeItem = function (this: Storage, key: string): void {
    originalRemoveItem.call(this, key);
    if (suppressWrites === 0) markDirty(key);
  };
  storagePatched = true;
}

function scanChangedKeys(): void {
  const storage = localStorageOrNull();
  if (!storage || !session) return;

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !isSyncableKey(key)) continue;
      const value = storage.getItem(key);
      if (state.docs[key]?.hash !== valueHash(value)) markDirty(key);
    }
  } catch {
    return;
  }

  for (const key of Object.keys(state.docs)) {
    if (
      isSyncableKey(key) &&
      storedValue(key) === null &&
      state.docs[key].hash !== valueHash(null)
    ) {
      markDirty(key);
    }
  }
}

function schedulePush(): void {
  if (!session || typeof window === "undefined") return;
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void syncNow().catch(() => undefined);
  }, PUSH_DEBOUNCE_MS);
}

function reconcileOnVisibility(): void {
  if (typeof document === "undefined" || document.visibilityState !== "visible") return;
  scanChangedKeys();
  schedulePush();
}

function startWatchers(): void {
  if (watchersStarted || !session) return;
  patchStorage();
  watchersStarted = true;

  if (typeof window !== "undefined") {
    reconcileTimer = window.setInterval(() => {
      scanChangedKeys();
      schedulePush();
    }, RECONCILE_MS);
  }
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", reconcileOnVisibility);
}

function stopWatchers(): void {
  if (debounceTimer !== null && typeof window !== "undefined") window.clearTimeout(debounceTimer);
  if (reconcileTimer !== null && typeof window !== "undefined")
    window.clearInterval(reconcileTimer);
  if (watchersStarted && typeof document !== "undefined")
    document.removeEventListener("visibilitychange", reconcileOnVisibility);
  debounceTimer = null;
  reconcileTimer = null;
  watchersStarted = false;
  dirty.clear();
}

function apiFor(activeSession: SyncSession): SyncApi {
  return new SyncApi(activeSession.endpoint, activeSession.token);
}

function remoteValue(activeSession: SyncSession, doc: SyncDoc): Promise<string | null> {
  if (doc.deleted || doc.ciphertext === null) return Promise.resolve(null);
  return decryptDoc(activeSession.dataKeyB64, doc.key, doc.ciphertext);
}

async function pullRemote(localNewerOnConflict: boolean): Promise<number> {
  const activeSession = session;
  if (!activeSession) return 0;

  const response = await apiFor(activeSession).getDocs(state.lastRev);
  let applied = 0;
  for (const doc of response.docs) {
    if (!isSyncableKey(doc.key)) continue;

    const remote = await remoteValue(activeSession, doc);
    const local = storedValue(doc.key);
    const known = state.docs[doc.key];
    const locallyChanged = !known || known.hash !== valueHash(local);
    const localNewer =
      localNewerOnConflict && (dirty.get(doc.key)?.updatedAt ?? 0) >= doc.updatedAt;
    const next = locallyChanged ? mergeDoc(doc.key, local, remote, localNewer) : remote;

    if (local !== next) {
      writeStoredValue(doc.key, next);
      applied += 1;
    }
    state.docs[doc.key] = { rev: doc.rev, hash: valueHash(remote) };
  }
  state.lastRev = response.rev;
  saveState();
  scanChangedKeys();
  return applied;
}

function recordSyncedDocument(key: string, rev: number, value: string | null): void {
  state.docs[key] = { rev, hash: valueHash(value) };
  if (valueHash(storedValue(key)) === valueHash(value)) dirty.delete(key);
}

async function resolveConflict(
  activeSession: SyncSession,
  result: Extract<PushResult, { status: "conflict" }>,
): Promise<void> {
  const remote = await remoteValue(activeSession, result.doc);
  const local = storedValue(result.key);
  const merged = mergeDoc(result.key, local, remote, true);
  writeStoredValue(result.key, merged);
  dirty.set(result.key, { updatedAt: Date.now() });
  state.docs[result.key] = { rev: result.doc.rev, hash: valueHash(remote) };

  const ciphertext =
    merged === null ? null : await encryptDoc(activeSession.dataKeyB64, result.key, merged);
  const response = await apiFor(activeSession).putDocs([
    { key: result.key, ciphertext, baseRev: result.doc.rev, updatedAt: Date.now() },
  ]);
  const retry = response.results[0];
  if (retry?.status === "ok") recordSyncedDocument(result.key, retry.rev, merged);
  saveState();
}

async function pushDirty(): Promise<boolean> {
  const activeSession = session;
  if (!activeSession) return false;

  const pending = Array.from(dirty.keys())
    .filter(isSyncableKey)
    .map((key) => ({ key, value: storedValue(key) }));
  if (pending.length === 0) return false;

  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    const docs: PushDoc[] = [];
    for (const entry of batch) {
      docs.push({
        key: entry.key,
        ciphertext:
          entry.value === null
            ? null
            : await encryptDoc(activeSession.dataKeyB64, entry.key, entry.value),
        baseRev: state.docs[entry.key]?.rev ?? 0,
        updatedAt: dirty.get(entry.key)?.updatedAt ?? Date.now(),
      });
    }

    const response = await apiFor(activeSession).putDocs(docs);
    const submitted = new Map(batch.map((entry) => [entry.key, entry.value]));
    for (const result of response.results) {
      if (result.status === "ok") {
        const value = submitted.get(result.key);
        recordSyncedDocument(result.key, result.rev, value ?? null);
      } else {
        await resolveConflict(activeSession, result);
      }
    }
    saveState();
  }

  return true;
}

function errorCode(error: unknown): string {
  return error instanceof SyncApiError
    ? error.code
    : error instanceof Error
      ? error.message
      : "sync_failed";
}

function clearSessionAfterUnauthorized(): void {
  clearSyncSession();
  session = null;
  stopWatchers();
  updateStatus({ signedIn: false, email: null, syncing: false, error: "unauthorized" });
}

function handleSyncError(error: unknown): void {
  if (error instanceof SyncApiError && error.invalidatesSession) {
    clearSessionAfterUnauthorized();
    return;
  }
  updateStatus({ error: errorCode(error) });
}

async function performSync(): Promise<void> {
  if (!session) throw new Error("not_signed_in");

  updateStatus({ syncing: true, error: null });
  try {
    await pullRemote(true);
    scanChangedKeys();
    const pushed = await pushDirty();
    if (pushed) await pullRemote(true);
    updateStatus({ lastSyncAt: Date.now(), error: null });
  } catch (error) {
    handleSyncError(error);
    throw error;
  } finally {
    if (session) updateStatus({ syncing: false });
  }
}

async function startupPull(): Promise<number> {
  const pull = pullRemote(false);
  // Executor form: Promise.withResolvers needs lib ES2024 and WebKitGTK >= 2.44,
  // above this repo's ES2022 floor.
  const timeout = new Promise<number>((resolve) => {
    if (typeof window === "undefined") {
      resolve(0);
      return;
    }
    window.setTimeout(() => resolve(0), STARTUP_PULL_TIMEOUT_MS);
  });
  return Promise.race([pull, timeout]);
}

function reloadOnceAfterStartupPull(): void {
  const storage = sessionStorageOrNull();
  if (!storage || typeof window === "undefined") return;

  try {
    if (storage.getItem(RELOAD_GUARD_KEY)) return;
    storage.setItem(RELOAD_GUARD_KEY, "1");
    window.location.reload();
  } catch {
    // A reload is optional when session storage is unavailable.
  }
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  statusSubscribers.add(fn);
  return () => statusSubscribers.delete(fn);
}

export async function initSyncEngine(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!session) return;
    const applied = await startupPull().catch(() => 0);
    startWatchers();
    scanChangedKeys();
    schedulePush();
    if (applied > 0) reloadOnceAfterStartupPull();
  })();
  return initPromise;
}

export async function signUpSync(email: string, password: string): Promise<void> {
  try {
    const endpoint = syncEndpoint();
    const kdfSalt = generateKdfSalt();
    const keys = await deriveKeys(password, kdfSalt, KDF_ITERATIONS);
    const { dataKeyB64 } = await generateDataKey();
    const wrappedDataKey = await wrapDataKey(keys.wrapKey, dataKeyB64);
    const response = await new SyncApi(endpoint).register({
      email,
      authHash: keys.authHash,
      kdfIterations: KDF_ITERATIONS,
      kdfSalt,
      wrappedDataKey,
    });

    session = {
      userId: response.userId,
      email,
      token: response.token,
      kdfIterations: KDF_ITERATIONS,
      kdfSalt,
      wrappedDataKey,
      dataKeyB64,
      endpoint,
    };
    state = emptyState();
    saveSyncSession(session);
    saveState();
    updateStatus({ signedIn: true, email, syncing: true, error: null });
    scanChangedKeys();
    await pushDirty();
    await pullRemote(false);
    startWatchers();
    updateStatus({ syncing: false, lastSyncAt: Date.now(), error: null });
  } catch (error) {
    if (session) updateStatus({ syncing: false });
    handleSyncError(error);
    throw error;
  }
}

function collectLocalSnapshot(): SnapshotMap {
  const storage = localStorageOrNull();
  const out: SnapshotMap = {};
  if (!storage) return out;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !isSyncableKey(key)) continue;
      const value = storage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    return out;
  }
  return out;
}

async function decryptRemoteSnapshot(
  activeSession: SyncSession,
  docs: SyncDoc[],
): Promise<SnapshotMap> {
  const out: SnapshotMap = {};
  for (const doc of docs) {
    if (!isSyncableKey(doc.key)) continue;
    const value = await remoteValue(activeSession, doc);
    if (value !== null) out[doc.key] = value;
  }
  return out;
}

function adoptRemoteState(pending: PendingAdoption): void {
  state = emptyState();
  state.lastRev = pending.rev;
  for (const doc of pending.docs) {
    if (!isSyncableKey(doc.key)) continue;
    state.docs[doc.key] = { rev: doc.rev, hash: valueHash(pending.remote[doc.key] ?? null) };
  }
}

export async function signInSync(email: string, password: string): Promise<void> {
  try {
    const endpoint = syncEndpoint();
    const unauthenticatedApi = new SyncApi(endpoint);
    const prelogin = await unauthenticatedApi.prelogin(email);
    const keys = await deriveKeys(password, prelogin.kdfSalt, prelogin.kdfIterations);
    const response = await unauthenticatedApi.login({ email, authHash: keys.authHash });
    let dataKeyB64: string;
    try {
      dataKeyB64 = await unwrapDataKey(keys.wrapKey, response.wrappedDataKey);
    } catch {
      throw new SyncApiError("invalid_credentials", 401);
    }

    const nextSession: SyncSession = {
      userId: response.userId,
      email,
      token: response.token,
      kdfIterations: response.kdfIterations,
      kdfSalt: response.kdfSalt,
      wrappedDataKey: response.wrappedDataKey,
      dataKeyB64,
      endpoint,
    };

    // A device with existing data joining an account with existing data must
    // not silently lose either side: park the session and let the user pick a
    // merge strategy (completeSyncSignIn / cancelSyncSignIn).
    const remoteDocs = await new SyncApi(endpoint, nextSession.token).getDocs(0);
    const remote = await decryptRemoteSnapshot(nextSession, remoteDocs.docs);
    const local = collectLocalSnapshot();
    if (needsAdoptionPrompt(local, remote)) {
      pendingAdoption = {
        session: nextSession,
        rev: remoteDocs.rev,
        docs: remoteDocs.docs,
        remote,
      };
      updateStatus({ pendingAdoption: buildAdoptionSummary(local, remote), error: null });
      return;
    }

    session = nextSession;
    state = emptyState();
    saveSyncSession(session);
    saveState();
    updateStatus({ signedIn: true, email, syncing: true, error: null });
    await pullRemote(false);
    scanChangedKeys();
    await pushDirty();
    await pullRemote(false);
    startWatchers();
    updateStatus({ syncing: false, lastSyncAt: Date.now(), error: null });
  } catch (error) {
    if (session) updateStatus({ syncing: false });
    handleSyncError(error);
    throw error;
  }
}

/** Apply the user's chosen adoption strategy and finish the parked sign-in. */
export async function completeSyncSignIn(plan: AdoptionPlan): Promise<void> {
  const pending = pendingAdoption;
  if (!pending) throw new Error("no_pending_adoption");

  try {
    const local = collectLocalSnapshot();
    const result = planAdoption(plan, local, pending.remote, mergeDoc);

    suppressWrites += 1;
    try {
      for (const [key, value] of Object.entries(result.writes)) {
        writeStoredValue(key, value);
      }
    } finally {
      suppressWrites -= 1;
    }

    session = pending.session;
    adoptRemoteState(pending);
    saveSyncSession(session);
    saveState();
    pendingAdoption = null;
    updateStatus({
      signedIn: true,
      email: session.email,
      syncing: true,
      error: null,
      pendingAdoption: null,
    });

    dirty.clear();
    for (const key of result.push) dirty.set(key, { updatedAt: Date.now() });
    await pushDirty();
    await pullRemote(false);
    updateStatus({ syncing: false, lastSyncAt: Date.now(), error: null });

    // Providers across the app read profiles/settings once at boot; a reload
    // is the only safe way to rebind everything to the merged dataset.
    if (typeof window !== "undefined") window.location.reload();
  } catch (error) {
    if (session) updateStatus({ syncing: false });
    handleSyncError(error);
    throw error;
  }
}

/** Abandon the parked sign-in and revoke its server session. */
export async function cancelSyncSignIn(): Promise<void> {
  const pending = pendingAdoption;
  pendingAdoption = null;
  updateStatus({ pendingAdoption: null });
  if (!pending) return;
  try {
    await new SyncApi(pending.session.endpoint, pending.session.token).logout();
  } catch {
    // The parked token expires server-side; local abandonment is what matters.
  }
}

export async function signOutSync(): Promise<void> {
  const activeSession = session;
  try {
    if (activeSession) await apiFor(activeSession).logout();
  } catch {
    // Clearing local credentials is intentional even while offline.
  } finally {
    clearSyncSession();
    clearState();
    session = null;
    pendingAdoption = null;
    stopWatchers();
    updateStatus({
      signedIn: false,
      email: null,
      syncing: false,
      error: null,
      pendingAdoption: null,
    });
  }
}

export async function syncNow(): Promise<void> {
  if (syncPromise) return syncPromise;
  const pending = performSync();
  syncPromise = pending;
  try {
    await pending;
  } finally {
    if (syncPromise === pending) syncPromise = null;
  }
}

export async function deleteSyncAccount(password: string): Promise<void> {
  const activeSession = session;
  if (!activeSession) throw new Error("not_signed_in");

  try {
    const keys = await deriveKeys(password, activeSession.kdfSalt, activeSession.kdfIterations);
    await apiFor(activeSession).deleteAccount(keys.authHash);
    clearSyncSession();
    clearState();
    session = null;
    stopWatchers();
    updateStatus({ signedIn: false, email: null, syncing: false, error: null });
  } catch (error) {
    handleSyncError(error);
    throw error;
  }
}
