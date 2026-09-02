import { activeProfileId } from "@/lib/active-profile-id";
import { getSecret, setSecret } from "@/lib/secret-store";
import type { MediaServerConnection } from "./types";
import { normalizeServerOrigin } from "./transport";
import { connectionQuality } from "./quality";

const KEY = "harbor.media-server.connections.v1";
const TOKEN = "harbor.media-server.token.v1";
const listeners = new Set<() => void>();

function all(): MediaServerConnection[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.map((connection) => {
      const migrated = { refreshInterval: "launch", ...connection } as MediaServerConnection;
      return { ...migrated, preferredQuality: connectionQuality(migrated) };
    });
  } catch {
    return [];
  }
}
function write(value: MediaServerConnection[]) {
  localStorage.setItem(KEY, JSON.stringify(value));
  listeners.forEach((fn) => fn());
}
export function mediaServerConnections(profileId = activeProfileId()) {
  return all().filter((c) => c.profileId === profileId);
}
export function saveMediaServerConnection(connection: MediaServerConnection, token?: string) {
  const clean = { ...connection, origin: normalizeServerOrigin(connection.origin) };
  write([...all().filter((c) => c.id !== clean.id), clean]);
  if (token != null) setSecret(`${TOKEN}.${clean.profileId}.${clean.id}`, token);
}
export function updateMediaServerConnection(
  id: string,
  patch: Partial<Omit<MediaServerConnection, "id" | "profileId" | "provider">>,
  profileId = activeProfileId(),
) {
  const current = all().find(
    (connection) => connection.id === id && connection.profileId === profileId,
  );
  if (!current) return;
  saveMediaServerConnection({ ...current, ...patch });
}
export function removeMediaServerConnection(id: string, profileId = activeProfileId()) {
  write(all().filter((c) => c.id !== id || c.profileId !== profileId));
  setSecret(`${TOKEN}.${profileId}.${id}`, null);
}
export function mediaServerToken(connection: MediaServerConnection) {
  return getSecret(`${TOKEN}.${connection.profileId}.${connection.id}`);
}
export function subscribeMediaServerConnections(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const REFRESH_MS: Record<MediaServerConnection["refreshInterval"], number> = {
  launch: 0,
  daily: 86_400_000,
  "three-days": 259_200_000,
  weekly: 604_800_000,
  custom: 0,
  manual: Number.POSITIVE_INFINITY,
};

export function mediaServerSyncDue(connection: MediaServerConnection, now = Date.now()): boolean {
  if (!connection.enabled || connection.refreshInterval === "manual") return false;
  if (connection.refreshInterval === "launch") return true;
  const interval =
    connection.refreshInterval === "custom"
      ? Math.max(1, connection.refreshEveryDays ?? 1) * 86_400_000
      : REFRESH_MS[connection.refreshInterval];
  return connection.lastSyncAt == null || now - connection.lastSyncAt >= interval;
}
