import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { SourceDescriptor } from "@/lib/together/protocol";
import type { PartialSyncState } from "@/lib/together/provider";
import { buildSourceDescriptor, descriptorsEqual } from "@/lib/together/source-descriptor";
import type { PlayerSrc, PlayerStreamRef } from "@/lib/view";
import { useEffect, useRef, useState, type RefObject } from "react";

const URL_CHANGE_DURATION_GUARD_MS = 1500;

export function useHostSource(params: {
  inRoom: boolean;
  isHost: boolean;
  hasStarted: boolean;
  src: PlayerSrc;
  liveUrl: string;
  liveStreamRef: PlayerStreamRef | undefined;
  snap: PlayerSnapshot;
  guestPickRef: RefObject<boolean>;
  publishState: (state: PartialSyncState) => void;
}): { hostSourceRef: RefObject<SourceDescriptor | null> } {
  const { inRoom, isHost, hasStarted, src, liveUrl, liveStreamRef, snap, guestPickRef, publishState } = params;

  const [validDurationSec, setValidDurationSec] = useState(0);
  const urlChangedAtRef = useRef(0);
  const firstUrlRef = useRef(true);
  useEffect(() => {
    if (firstUrlRef.current) {
      firstUrlRef.current = false;
      return;
    }
    urlChangedAtRef.current = Date.now();
    setValidDurationSec(0);
  }, [liveUrl]);
  useEffect(() => {
    if (snap.durationSec <= 0) return;
    if (snap.status !== "playing" && snap.status !== "paused") return;
    if (Date.now() - urlChangedAtRef.current < URL_CHANGE_DURATION_GUARD_MS) return;
    setValidDurationSec(snap.durationSec);
  }, [snap.durationSec, snap.status]);

  const stableRef = useRef<SourceDescriptor | null>(null);
  const next = buildSourceDescriptor(
    liveStreamRef ?? src.streamRef ?? null,
    validDurationSec > 0 ? validDurationSec : undefined,
  );
  if (!descriptorsEqual(stableRef.current, next)) stableRef.current = next;
  const descriptor = stableRef.current;

  const hostSourceRef = useRef<SourceDescriptor | null>(null);
  hostSourceRef.current = descriptor;

  const lastSeedRef = useRef<SourceDescriptor | null>(null);
  useEffect(() => {
    if (!inRoom || !isHost || hasStarted) {
      lastSeedRef.current = null;
      return;
    }
    if (!descriptor) return;
    if (descriptorsEqual(lastSeedRef.current, descriptor)) return;
    lastSeedRef.current = descriptor;
    publishState({
      mediaId: src.meta.id,
      mediaTitle: src.meta.name ?? null,
      episode: src.episode
        ? { season: src.episode.season, episode: src.episode.episode, name: src.episode.name }
        : null,
      posterUrl: src.meta.poster ?? null,
      positionSeconds: Math.max(0, getPlaybackPosition()),
      playing: snap.status === "playing",
      speed: snap.rate,
      source: descriptor,
      guestPick: guestPickRef.current || undefined,
    });
  }, [inRoom, isHost, hasStarted, descriptor, publishState, src.meta.id, src.meta.name, src.meta.poster, src.episode]);

  return { hostSourceRef };
}
