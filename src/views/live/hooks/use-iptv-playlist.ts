import { getCachedPlaylist, loadPlaylist, subscribePlaylists } from "@/lib/iptv/store";
import type { IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { useEffect, useState } from "react";

type PlaylistState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; playlist: IptvPlaylist }
  | { kind: "error"; message: string };

export function useIptvPlaylist(source: IptvPlaylistSource | null): {
  state: PlaylistState;
  refresh: () => void;
} {
  const [state, setState] = useState<PlaylistState>({ kind: "idle" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!source) {
      setState({ kind: "idle" });
      return;
    }
    const id = source.id;
    let cancelled = false;
    setState({ kind: "loading" });
    loadPlaylist(source, { force: tick > 0 })
      .then((pl) => {
        if (cancelled) return;
        setState({ kind: "ready", playlist: pl });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      });
    const unsub = subscribePlaylists(() => {
      if (cancelled) return;
      const cached = getCachedPlaylist(id);
      if (cached) setState({ kind: "ready", playlist: cached });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [source?.id, source?.url, tick]);

  return {
    state,
    refresh: () => setTick((n) => n + 1),
  };
}
