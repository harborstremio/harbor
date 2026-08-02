import { useCallback } from "react";
import { useSettings, type Settings } from "@/lib/settings";
import { clearPlaylistCache } from "@/lib/iptv/store";
import { clearEpg } from "@/lib/iptv/epg-store";
import { deleteIptvCache } from "@/lib/iptv/persistent-cache";
import { purgePlaylistState } from "@/lib/iptv/source-cleanup";
import { useFavorites } from "@/lib/iptv/favorites";
import { buildXtreamUrls, type PlaylistFormValue } from "../source-picker/playlist-form";

type StoredPlaylist = Settings["iptvPlaylists"][number];

export function materializePlaylistEntry(id: string, entry: PlaylistFormValue): StoredPlaylist {
  if (entry.kind === "xtream") {
    const { m3u, epg } = buildXtreamUrls(
      entry.xtream.server,
      entry.xtream.username,
      entry.xtream.password,
    );
    return {
      id,
      name: entry.name,
      url: m3u,
      epgUrl: epg,
      kind: "xtream",
      xtream: {
        server: entry.xtream.server.replace(/\/+$/, ""),
        username: entry.xtream.username,
        password: entry.xtream.password,
      },
    };
  }
  if (entry.kind === "epg") {
    return { id, name: entry.name, url: "", epgUrl: entry.epgUrl, kind: "epg" };
  }
  return { id, name: entry.name, url: entry.url, epgUrl: entry.epgUrl || undefined, kind: "m3u" };
}

export function usePlaylistMutations(params: {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  refresh: () => void;
}) {
  const { activeId, setActiveId, refresh } = params;
  const { settings, update } = useSettings();
  const favorites = useFavorites();
  const playlists = settings.iptvPlaylists;

  const addPlaylist = useCallback(
    (entry: PlaylistFormValue) => {
      const id = `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const built = materializePlaylistEntry(id, entry);
      const carriesVod = entry.kind === "xtream" || entry.kind === "m3u";
      update({
        iptvPlaylists: [...playlists, built],
        ...(carriesVod && !settings.showPlaylistsTab ? { showPlaylistsTab: true } : {}),
      });
      if (entry.kind !== "epg") setActiveId(id);
    },
    [playlists, update, setActiveId, settings.showPlaylistsTab],
  );

  const removePlaylist = useCallback(
    (id: string) => {
      const next = playlists.filter((s) => s.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      update({ iptvPlaylists: next });
      purgePlaylistState(id, favorites.removeForSource);
    },
    [playlists, update, activeId, setActiveId, favorites.removeForSource],
  );

  const editPlaylist = useCallback(
    (id: string, entry: PlaylistFormValue) => {
      const next = playlists.map((s) => (s.id === id ? materializePlaylistEntry(id, entry) : s));
      update({ iptvPlaylists: next });
      clearPlaylistCache(id);
      void deleteIptvCache("xtream-vod", id);
      clearEpg(id);
      if (activeId === id) refresh();
    },
    [playlists, update, activeId, refresh],
  );

  const reorderPlaylist = useCallback(
    (id: string, delta: number) => {
      const i = playlists.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= playlists.length) return;
      const next = playlists.slice();
      [next[i], next[j]] = [next[j], next[i]];
      update({ iptvPlaylists: next });
    },
    [playlists, update],
  );

  const movePlaylistTop = useCallback(
    (id: string) => {
      const i = playlists.findIndex((s) => s.id === id);
      if (i <= 0) return;
      const next = playlists.slice();
      const [item] = next.splice(i, 1);
      next.unshift(item);
      update({ iptvPlaylists: next });
    },
    [playlists, update],
  );

  return { addPlaylist, removePlaylist, editPlaylist, reorderPlaylist, movePlaylistTop };
}
