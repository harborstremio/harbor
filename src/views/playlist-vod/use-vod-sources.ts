import { clearEpg } from "@/lib/iptv/epg-store";
import { useFavorites } from "@/lib/iptv/favorites";
import { purgePlaylistState } from "@/lib/iptv/source-cleanup";
import { clearPlaylistCache } from "@/lib/iptv/store";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import { buildXtreamUrls, type PlaylistFormValue } from "@/views/live/source-picker/playlist-form";
import { useCallback, useEffect, useMemo, useState } from "react";

const ACTIVE_KEY = "harbor.vod.active";

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActive(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* noop */
  }
}

function materialize(id: string, entry: PlaylistFormValue) {
  if (entry.kind === "xtream") {
    const { m3u, epg } = buildXtreamUrls(entry.xtream.server, entry.xtream.username, entry.xtream.password);
    return {
      id,
      name: entry.name,
      url: m3u,
      epgUrl: epg,
      kind: "xtream" as const,
      xtream: {
        server: entry.xtream.server.replace(/\/+$/, ""),
        username: entry.xtream.username,
        password: entry.xtream.password,
      },
    };
  }
  return {
    id,
    name: entry.name,
    url: entry.url,
    epgUrl: entry.epgUrl || undefined,
    kind: "m3u" as const,
  };
}

export function useVodSources() {
  const { settings, update } = useSettings();
  const favorites = useFavorites();

  const sources = useMemo<IptvPlaylistSource[]>(
    () =>
      settings.iptvPlaylists
        .filter((p) => (p.kind ?? "m3u") !== "epg")
        .map((p) => ({ id: p.id, name: p.name, url: p.url, epgUrl: p.epgUrl, kind: p.kind, xtream: p.xtream })),
    [settings.iptvPlaylists],
  );

  const [activeId, setActiveId] = useState<string | null>(() => readActive());

  useEffect(() => {
    if (sources.length === 0) {
      if (activeId !== null) {
        setActiveId(null);
        writeActive(null);
      }
      return;
    }
    if (!activeId || !sources.find((s) => s.id === activeId)) {
      const fallback = sources[0]?.id ?? null;
      setActiveId(fallback);
      writeActive(fallback);
    }
  }, [sources, activeId]);

  const selectId = useCallback((id: string) => {
    setActiveId(id);
    writeActive(id);
  }, []);

  const addPlaylist = useCallback(
    (entry: PlaylistFormValue) => {
      if (entry.kind === "epg") return;
      const id = `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      update({ iptvPlaylists: [...settings.iptvPlaylists, materialize(id, entry)] });
      setActiveId(id);
      writeActive(id);
    },
    [settings.iptvPlaylists, update],
  );

  const editPlaylist = useCallback(
    (id: string, entry: PlaylistFormValue) => {
      const next = settings.iptvPlaylists.map((s) => (s.id === id ? materialize(id, entry) : s));
      update({ iptvPlaylists: next });
      clearPlaylistCache(id);
      clearEpg(id);
    },
    [settings.iptvPlaylists, update],
  );

  const removePlaylist = useCallback(
    (id: string) => {
      const next = settings.iptvPlaylists.filter((s) => s.id !== id);
      if (activeId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveId(fallback);
        writeActive(fallback);
      }
      update({ iptvPlaylists: next });
      purgePlaylistState(id, favorites.removeForSource);
    },
    [settings.iptvPlaylists, update, activeId, favorites.removeForSource],
  );

  return { sources, activeId, selectId, addPlaylist, editPlaylist, removePlaylist };
}
