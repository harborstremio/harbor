import { DEFAULT_SYNC_ENDPOINT } from "./api";

const SESSION_KEY = "harbor.sync.session.v1";
const ENDPOINT_KEY = "harbor.sync.endpoint";

export type SyncSession = {
  userId: string;
  email: string;
  token: string;
  kdfIterations: number;
  kdfSalt: string;
  wrappedDataKey: string;
  dataKeyB64: string;
  endpoint: string;
};

function localStorageOrNull(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function isSyncSession(value: unknown): value is SyncSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.userId === "string" &&
    typeof session.email === "string" &&
    typeof session.token === "string" &&
    typeof session.kdfIterations === "number" &&
    typeof session.kdfSalt === "string" &&
    typeof session.wrappedDataKey === "string" &&
    typeof session.dataKeyB64 === "string" &&
    typeof session.endpoint === "string"
  );
}

export function loadSyncSession(): SyncSession | null {
  try {
    const raw = localStorageOrNull()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: unknown = JSON.parse(raw);
    return isSyncSession(session) ? session : null;
  } catch {
    return null;
  }
}

export function saveSyncSession(session: SyncSession): void {
  try {
    localStorageOrNull()?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable in private or constrained browser contexts.
  }
}

export function clearSyncSession(): void {
  try {
    localStorageOrNull()?.removeItem(SESSION_KEY);
  } catch {
    // Storage may be unavailable in private or constrained browser contexts.
  }
}

export function syncEndpoint(): string {
  try {
    return localStorageOrNull()?.getItem(ENDPOINT_KEY) || DEFAULT_SYNC_ENDPOINT;
  } catch {
    return DEFAULT_SYNC_ENDPOINT;
  }
}

/** Persist the sync server override; `null` (or the official URL) restores the default. */
export function setSyncEndpoint(url: string | null): void {
  try {
    const storage = localStorageOrNull();
    if (!storage) return;
    if (!url || url === DEFAULT_SYNC_ENDPOINT) storage.removeItem(ENDPOINT_KEY);
    else storage.setItem(ENDPOINT_KEY, url);
  } catch {
    // Storage may be unavailable in private or constrained browser contexts.
  }
}
