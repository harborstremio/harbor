import { useSyncExternalStore } from "react";
import type { PlayerSrc } from "./view";
import type { PlayerReturnOptions } from "./player/return-to-playback";
import { parseMagnet } from "./torrent/magnet";
import { magnetFromHash } from "./debrid/types";

export function playerMagnetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = parseMagnet(value);
    if (!parsed) return null;
    return /^magnet:/i.test(value.trim()) ? value.trim() : magnetFromHash(parsed.infoHash);
  } catch {
    return null;
  }
}

export type PlayerActions = {
  download: () => void;
  toggleFullscreen: () => void;
  canDownload: boolean;
  downloadSubtitle: () => void;
  canDownloadSubtitle: boolean;
  streamUrl: string | null;
  infoHash: string | null;
  magnetUrl?: string | null;
  liveSync?: () => void | Promise<void>;
  canLiveSync?: boolean;
  src?: PlayerSrc;
  returnToPlayer?: (options?: PlayerReturnOptions) => Promise<void>;
};

let current: PlayerActions | null = null;
const listeners = new Set<() => void>();

export function setPlayerActions(actions: PlayerActions | null) {
  if (current === actions) return;
  if (
    current &&
    actions &&
    current.download === actions.download &&
    current.toggleFullscreen === actions.toggleFullscreen &&
    current.canDownload === actions.canDownload &&
    current.downloadSubtitle === actions.downloadSubtitle &&
    current.canDownloadSubtitle === actions.canDownloadSubtitle &&
    current.streamUrl === actions.streamUrl &&
    current.infoHash === actions.infoHash &&
    current.magnetUrl === actions.magnetUrl &&
    current.liveSync === actions.liveSync &&
    current.canLiveSync === actions.canLiveSync &&
    current.src === actions.src &&
    current.returnToPlayer === actions.returnToPlayer
  ) {
    return;
  }
  current = actions;
  for (const l of listeners) l();
}

export function currentPlayerActions(): PlayerActions | null {
  return current;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePlayerActions(): PlayerActions | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
