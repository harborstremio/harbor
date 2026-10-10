import { useCallback } from "react";
import { useSettings } from "@/lib/settings";
import { usePlaylists, writePlaylists } from "@/lib/iptv/playlists-store";
import { clearPlaylistCache } from "@/lib/iptv/store";
import { clearEpg } from "@/lib/iptv/epg-store";
import { deleteIptvCache } from "@/lib/iptv/persistent-cache";
import { purgePlaylistState } from "@/lib/iptv/source-cleanup";
import { useFavorites } from "@/lib/iptv/favorites";
import { alertDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import {
  materializePlaylistEntry,
  newPlaylistId,
  type PlaylistFormValue,
} from "@/lib/iptv/playlist-entry";

export { materializePlaylistEntry };

export function usePlaylistMutations(params: {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  refresh: () => void;
}) {
  const { activeId, setActiveId, refresh } = params;
  const { settings, update } = useSettings();
  const favorites = useFavorites();
  const playlists = usePlaylists();
  const t = useT();

  const addPlaylist = useCallback(
    (entry: PlaylistFormValue) => {
      const id = newPlaylistId();
      const built = materializePlaylistEntry(id, entry);
      const carriesVod = entry.kind === "xtream" || entry.kind === "m3u";
      const persisted = writePlaylists([...playlists, built]);
      if (!persisted) {
        console.warn("harbor: playlist not persisted (storage quota)", id);
        void alertDialog(
          t("Couldn't save the playlist. Free up storage space in Settings and try again."),
        );
      }
      if (carriesVod && !settings.showPlaylistsTab) update({ showPlaylistsTab: true });
      if (entry.kind !== "epg") setActiveId(id);
      return persisted;
    },
    [playlists, update, setActiveId, settings.showPlaylistsTab, t],
  );

  const removePlaylist = useCallback(
    (id: string) => {
      const next = playlists.filter((s) => s.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      writePlaylists(next);
      purgePlaylistState(id, favorites.removeForSource);
    },
    [playlists, activeId, setActiveId, favorites.removeForSource],
  );

  const editPlaylist = useCallback(
    (id: string, entry: PlaylistFormValue) => {
      const next = playlists.map((s) => (s.id === id ? materializePlaylistEntry(id, entry) : s));
      writePlaylists(next);
      clearPlaylistCache(id);
      void deleteIptvCache("xtream-vod", id);
      clearEpg(id);
      if (activeId === id) refresh();
    },
    [playlists, activeId, refresh],
  );

  const reorderPlaylist = useCallback(
    (id: string, delta: number) => {
      const i = playlists.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= playlists.length) return;
      const next = playlists.slice();
      [next[i], next[j]] = [next[j], next[i]];
      writePlaylists(next);
    },
    [playlists],
  );

  const movePlaylistTop = useCallback(
    (id: string) => {
      const i = playlists.findIndex((s) => s.id === id);
      if (i <= 0) return;
      const next = playlists.slice();
      const [item] = next.splice(i, 1);
      next.unshift(item);
      writePlaylists(next);
    },
    [playlists],
  );

  return { addPlaylist, removePlaylist, editPlaylist, reorderPlaylist, movePlaylistTop };
}
