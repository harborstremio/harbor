import { mediaServerAdapter } from "./sync";
import type { MediaServerConnection } from "./types";

export type MediaServerHealth = "checking" | "active" | "inactive";

let snapshot: Record<string, MediaServerHealth> = {};
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<MediaServerHealth>>();

function update(id: string, status: MediaServerHealth) {
  if (snapshot[id] === status) return;
  snapshot = { ...snapshot, [id]: status };
  listeners.forEach((listener) => listener());
}

export function getMediaServerHealthSnapshot() {
  return snapshot;
}
export function subscribeMediaServerHealth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markMediaServerInactive(connectionId: string) {
  update(connectionId, "inactive");
}

export function probeMediaServerHealth(
  connection: MediaServerConnection,
): Promise<MediaServerHealth> {
  if (!connection.enabled) {
    update(connection.id, "inactive");
    return Promise.resolve("inactive");
  }
  const existing = pending.get(connection.id);
  if (existing) return existing;
  if (!snapshot[connection.id]) update(connection.id, "checking");
  const request = mediaServerAdapter(connection)
    .libraries(connection)
    .then(() => {
      update(connection.id, "active");
      return "active" as const;
    })
    .catch(() => {
      update(connection.id, "inactive");
      return "inactive" as const;
    })
    .finally(() => pending.delete(connection.id));
  pending.set(connection.id, request);
  return request;
}
