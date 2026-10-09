import { useEffect, useState } from "react";
import { musicRadioTracks } from "./player";
import type { MusicTrack } from "./types";

const cache = new Map<string, MusicTrack[]>();

function keyOf(track: Pick<MusicTrack, "id" | "connectorId">): string {
  return `${track.connectorId ?? ""}:${track.id}`;
}

export type UpNextSuggestions = { tracks: MusicTrack[]; loading: boolean };

export function useUpNextSuggestions(
  track: MusicTrack | null | undefined,
  enabled: boolean,
): UpNextSuggestions {
  const key = track ? keyOf(track) : "";
  const [state, setState] = useState<UpNextSuggestions>(() => ({
    tracks: key ? cache.get(key) ?? [] : [],
    loading: false,
  }));

  useEffect(() => {
    if (!enabled || !track || !key) {
      setState({ tracks: [], loading: false });
      return;
    }
    const held = cache.get(key);
    if (held) {
      setState({ tracks: held, loading: false });
      return;
    }
    let live = true;
    setState({ tracks: [], loading: true });
    void musicRadioTracks(track)
      .then((station) => {
        const following = station.filter((entry) => keyOf(entry) !== key);
        if (following.length) cache.set(key, following);
        if (live) setState({ tracks: following, loading: false });
      })
      .catch(() => {
        if (live) setState({ tracks: [], loading: false });
      });
    return () => {
      live = false;
    };
  }, [enabled, key, track]);

  return state;
}
