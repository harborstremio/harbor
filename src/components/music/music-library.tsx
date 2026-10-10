import { type FormEvent, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FileUp, FolderOpen, LoaderCircle, Plus, Search, X } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Dropdown } from "@/components/dropdown";
import { MusicLocalCollection } from "./music-local-collection";
import { MusicSpotifyLibrary } from "./music-spotify-library";
import { useMusicConnections } from "./music-connections";
import { MusicPlaylistGridSkeleton } from "@/components/music/music-skeletons";
import { MusicServiceLogo } from "./music-service-logo";
import { MusicCollectionGrid } from "./music-collection-grid";
import { MusicLibraryEmptyState } from "./music-library-empty-state";
import { useT } from "@/lib/i18n";
import {
  addTracksToMusicPlaylist,
  createMusicPlaylist,
  importMusicM3u,
  listMusicPlaylists,
} from "@/lib/music/library";
import { localCollection } from "@/lib/music/catalog";
import {
  arrangeCollections,
  catalogEntry,
  likedEntry,
  playlistEntry,
  recentEntry,
  type MusicCollectionEntry,
  type MusicCollectionSort,
} from "@/lib/music/library-collections";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import type { MusicCatalogItem, MusicPlaylist } from "@/lib/music/types";
import "./music-library.css";

type LibraryFilter = "all" | "playlists" | "albums" | "artists" | "tracks" | "spotify";
const FILTERS: LibraryFilter[] = ["all", "playlists", "albums", "artists", "tracks", "spotify"];
const LOCAL: LibraryFilter[] = ["albums", "artists", "tracks"];

export function MusicLibrary({
  onOpen,
  onCollection,
  onTastes,
  active = true,
  initialView,
  initialSpotifyKind,
}: {
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onCollection: (entry: MusicCollectionEntry) => void;
  onTastes: () => void;
  active?: boolean;
  initialView?: string;
  initialSpotifyKind?: "playlists" | "liked";
}) {
  const t = useT();
  const { openConnections } = useMusicConnections();
  const player = useMusicPlayback();
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [shelf, setShelf] = useState<MusicCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<LibraryFilter>(() =>
    (FILTERS as string[]).includes(initialView ?? "") ? (initialView as LibraryFilter) : "all",
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MusicCollectionSort>("recent");
  const [creating, setCreating] = useState(false);
  const [playlistName, setPlaylistName] = useState("");

  useEffect(() => {
    if (initialView && (FILTERS as string[]).includes(initialView))
      setFilter(initialView as LibraryFilter);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReadError(null);
    void listMusicPlaylists()
      .then((next) => {
        if (!cancelled) setPlaylists(next);
      })
      .catch((reason) => {
        if (!cancelled) setReadError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    window.addEventListener("harbor:music-library-changed", changed);
    return () => window.removeEventListener("harbor:music-library-changed", changed);
  }, []);

  // Only the first page of each, so the unified view stays a shelf you can scan rather
  // than the whole local collection, which the Albums and Artists filters already page.
  useEffect(() => {
    if (filter !== "all") return;
    let cancelled = false;
    void Promise.all([
      localCollection("albums", "", 0).catch(() => null),
      localCollection("artists", "", 0).catch(() => null),
    ]).then(([albums, artists]) => {
      if (cancelled) return;
      setShelf([...(albums?.items ?? []), ...(artists?.items ?? [])]);
    });
    return () => {
      cancelled = true;
    };
  }, [filter, revision]);

  const entries = useMemo(() => {
    const built: MusicCollectionEntry[] = [];
    if (player.likedTracks.length > 0)
      built.push(likedEntry(player.likedTracks, t("music.saved"), t("music.library.savedTracks")));
    if (player.recents.length > 0)
      built.push(recentEntry(player.recents, t("music.library.recent"), t("music.library.recent")));
    for (const playlist of playlists) built.push(playlistEntry(playlist, t("music.playlists")));
    if (filter === "all")
      for (const item of shelf) {
        const entry = catalogEntry(item, t("music.connections.local"));
        if (entry) built.push(entry);
      }
    return built;
  }, [player.likedTracks, player.recents, playlists, shelf, filter, t]);

  const arranged = useMemo(
    () => arrangeCollections(entries, filter === "spotify" ? "all" : filter, sort, query),
    [entries, filter, sort, query],
  );

  const createPlaylist = (event: FormEvent) => {
    event.preventDefault();
    const name = playlistName.trim();
    if (!name || working) return;
    setWorking(true);
    setError(null);
    void createMusicPlaylist(name)
      .then((playlist) => {
        setPlaylists((current) => [playlist, ...current.filter((item) => item.id !== playlist.id)]);
        setPlaylistName("");
        setCreating(false);
        setFilter("playlists");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const importM3u = () => {
    if (working) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    void (async () => {
      const path = await open({
        multiple: false,
        filters: [{ name: t("music.m3u.playlist"), extensions: ["m3u", "m3u8"] }],
      });
      if (typeof path !== "string") return;
      const tracks = await importMusicM3u(path);
      const playlist = await createMusicPlaylist(nameFromM3uPath(path, t("music.m3u.imported")));
      const populated = await addTracksToMusicPlaylist(playlist.id, tracks);
      setPlaylists((current) => [populated, ...current.filter((item) => item.id !== populated.id)]);
      setFilter("playlists");
      setNotice(t("music.m3u.importedNotice", { count: tracks.length, name: populated.name }));
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const grid = filter === "all" || filter === "playlists";
  const filterLabel = (value: LibraryFilter) =>
    value === "spotify"
      ? "Spotify"
      : t(
          value === "all"
            ? "music.library.all"
            : value === "playlists"
              ? "music.playlists"
              : `music.search.${value}`,
        );
  const countFor = (value: LibraryFilter) =>
    value === "playlists" ? playlists.length + (player.likedTracks.length > 0 ? 1 : 0) : 0;

  return (
    <div className="music-library">
      <header className="music-library-header">
        <div>
          <h2>{t("music.library")}</h2>
          <p>{t("music.library.permanent")}</p>
        </div>
        <div className="music-library-actions music-library-header-actions">
          <HoverTooltip label={t("music.home.addFolder")} align="center">
              <button
                type="button"
                className="music-library-icon-action"
                aria-label={t("music.home.addFolder")}
                onClick={() => openConnections("local")}
              >
                <FolderOpen size={28} aria-hidden="true" />
              </button>
          </HoverTooltip>
          <HoverTooltip label={t("music.m3u.import")} align="center">
              <button
                type="button"
                className="music-library-icon-action"
                aria-label={t("music.m3u.import")}
                aria-busy={working}
                disabled={working}
                onClick={importM3u}
              >
                <FileUp size={28} aria-hidden="true" />
              </button>
          </HoverTooltip>
          <HoverTooltip label={t("music.row.newPlaylist")} align="end">
              <button
                type="button"
                className="music-library-icon-action"
                aria-label={t("music.row.newPlaylist")}
                aria-expanded={creating}
                onClick={() => {
                  setFilter("playlists");
                  setCreating((value) => !value);
                }}
              >
                <Plus size={28} aria-hidden="true" />
              </button>
          </HoverTooltip>
        </div>
      </header>

      <div className="music-library-bar">
        <nav className="music-library-views" aria-label={t("music.library")}>
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              data-library-view={value}
              aria-current={filter === value ? "page" : undefined}
              onClick={() => {
                setFilter(value);
                setQuery("");
              }}
            >
              {value === "spotify" && <MusicServiceLogo source="spotify" size={18} />}
              {filterLabel(value)}
              {countFor(value) > 0 && <small>{countFor(value)}</small>}
            </button>
          ))}
        </nav>
        {grid && (
          <div className="music-library-actions">
            <label className="music-library-search">
              <Search size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={200}
                aria-label={t("music.searchLabel")}
                placeholder={t("music.searchPlaceholder")}
              />
              {query && (
                <button
                  type="button"
                  aria-label={t("music.search.clear")}
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <Dropdown
              value={sort}
              onChange={(value) => setSort(value as MusicCollectionSort)}
              options={[
                { value: "recent", label: t("music.sort.recent") },
                { value: "name", label: t("music.sort.name") },
                { value: "size", label: t("music.sort.size") },
              ]}
              ariaLabel={t("music.sort.label")}
              className="music-library-sort"
            />
          </div>
        )}
      </div>

      {creating && (
        <form className="music-library-create" onSubmit={createPlaylist}>
          <input
            autoFocus
            value={playlistName}
            onChange={(event) => setPlaylistName(event.target.value)}
            maxLength={100}
            aria-label={t("music.playlist.nameLabel")}
            placeholder={t("music.playlist.namePlaceholder")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setCreating(false);
              }
            }}
          />
          <button
            type="submit"
            className="music-library-button"
            disabled={!playlistName.trim() || working}
          >
            {working ? (
              <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Plus size={17} />
            )}
            {t("music.playlist.create")}
          </button>
          <button type="button" className="music-library-text" onClick={() => setCreating(false)}>
            {t("common.cancel")}
          </button>
        </form>
      )}

      {(error || notice) && (
        <p
          className={`music-library-notice ${error ? "text-danger" : "text-ink-muted"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? notice}
        </p>
      )}
      {readError && grid && (
        <div className="music-library-empty" role="alert">
          <p>{readError}</p>
          <button
            type="button"
            className="music-library-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {grid &&
        (loading ? (
          <MusicPlaylistGridSkeleton />
        ) : (
          <MusicCollectionGrid
            entries={arranged}
            emptyCopy={t(query ? "music.searchEmpty" : "music.playlist.first")}
            emptyState={!query && !readError ? <MusicLibraryEmptyState onConnect={() => openConnections("local")} onTastes={onTastes} /> : undefined}
            onOpen={(entry) => (entry.item ? onOpen(entry.item, shelf) : onCollection(entry))}
          />
        ))}
      {LOCAL.includes(filter) && (
        <MusicLocalCollection
          key={filter}
          kind={filter as "albums" | "artists" | "tracks"}
          query=""
          onOpen={onOpen}
          onConnect={() => openConnections("local")}
          onTastes={onTastes}
        />
      )}
      {filter === "spotify" && (
        <MusicSpotifyLibrary
          active={active}
          initialKind={initialSpotifyKind}
          onImported={(playlist) =>
            setPlaylists((current) => [
              playlist,
              ...current.filter((item) => item.id !== playlist.id),
            ])
          }
        />
      )}
    </div>
  );
}

function nameFromM3uPath(path: string, fallback: string): string {
  const file = path.split(/[\\/]/).pop() ?? fallback;
  return file.replace(/\.m3u8?$/i, "").trim() || fallback;
}
