import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { SourceDescriptor } from "@/lib/together/protocol";
import type { PartialSyncState } from "@/lib/together/provider";
import type { PlayerSrc } from "@/lib/view";
import { useEffect, useRef, type RefObject } from "react";

export function useCastReturnPublish(params: {
  casting: boolean;
  inRoom: boolean;
  isHost: boolean;
  src: PlayerSrc;
  snapRef: RefObject<PlayerSnapshot>;
  hostSourceRef: RefObject<SourceDescriptor | null>;
  guestPickRef: RefObject<boolean>;
  publishState: (state: PartialSyncState) => void;
}) {
  const { casting, inRoom, isHost, src, snapRef, hostSourceRef, guestPickRef, publishState } = params;
  const wasCastingRef = useRef(false);
  useEffect(() => {
    if (wasCastingRef.current && !casting && inRoom && isHost) {
      const s = snapRef.current;
      publishState({
        mediaId: src.meta.id,
        mediaTitle: src.meta.name ?? null,
        episode: src.episode
          ? { season: src.episode.season, episode: src.episode.episode, name: src.episode.name }
          : null,
        posterUrl: src.meta.poster ?? null,
        positionSeconds: getPlaybackPosition(),
        playing: s.status === "playing",
        source: hostSourceRef.current ?? undefined,
        guestPick: guestPickRef.current || undefined,
      });
    }
    wasCastingRef.current = casting;
  }, [casting, inRoom, isHost, publishState, src.meta.id, src.meta.name, src.meta.poster, src.episode]);
}
