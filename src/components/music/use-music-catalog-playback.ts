import { useEffect, useRef, useState } from "react";
import { useMusicSourcePicker } from "./music-source-picker";
import { albumTracks, artistTop, catalogPlaylistTracks, stationTracks } from "@/lib/music/catalog";
import { useT } from "@/lib/i18n";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { registerMusicCatalogOrigin, registerMusicQueueOrigin } from "@/lib/music/playback-origin";

let latestRequest = 0;

export function useMusicCatalogPlayback() {
  const { openSourcePicker } = useMusicSourcePicker();
  const t = useT();
  const request = useRef(0);
  const [pending, setPending] = useState<MusicCatalogItem | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { request.current = 0; }, []);

  const play = async (item: MusicCatalogItem, siblings: readonly MusicCatalogItem[] = [], rowId?: string) => {
    const current = ++latestRequest;
    request.current = current;
    setError("");
    setPending(item);
    try {
      const tracks: MusicTrack[] = item.kind === "track"
        ? siblings.filter((entry): entry is Extract<MusicCatalogItem, { kind: "track" }> => entry.kind === "track")
        : item.kind === "album"
          ? await albumTracks(item)
          : item.kind === "playlist"
            ? await catalogPlaylistTracks(item)
            : item.kind === "artist"
              ? await artistTop(item)
              : await stationTracks(item);
      if (request.current !== current || latestRequest !== current) return;
      const track = item.kind === "track" ? item : tracks[0];
      if (!track) {
        setError(t("music.row.emptyRow"));
        return;
      }
      const queue = tracks.length ? tracks : [track];
      if (item.kind === "track" && rowId === "spotify:home:saved-tracks") {
        registerMusicQueueOrigin(queue, {
          kind: "spotify", id: "spotify:liked", name: t("music.spotifyLibrary.liked"),
          collection: "liked", nextOffset: 0,
        });
      } else registerMusicCatalogOrigin(item, queue);
      openSourcePicker(track, queue);
    } catch {
      if (request.current === current && latestRequest === current) setError(t("music.error.load"));
    } finally {
      if (request.current === current) setPending(null);
    }
  };

  return { play, pending, error };
}
