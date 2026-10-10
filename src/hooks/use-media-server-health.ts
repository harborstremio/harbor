import { useEffect, useSyncExternalStore } from "react";
import {
  getMediaServerHealthSnapshot,
  probeMediaServerHealth,
  subscribeMediaServerHealth,
} from "@/lib/media-server/health";
import type { MediaServerConnection } from "@/lib/media-server/types";

export function useMediaServerHealth(connections: MediaServerConnection[]) {
  const snapshot = useSyncExternalStore(subscribeMediaServerHealth, getMediaServerHealthSnapshot);
  const key = connections
    .map((connection) => `${connection.id}:${connection.origin}:${connection.enabled}`)
    .join("|");
  useEffect(() => {
    const probe = () => {
      connections.forEach((connection) => void probeMediaServerHealth(connection));
    };
    probe();
    const timer = window.setInterval(probe, 30_000);
    window.addEventListener("focus", probe);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", probe);
    };
  }, [key]);
  return snapshot;
}
