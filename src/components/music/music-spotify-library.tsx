import { MusicPlaylistToolbar } from "@/components/music/music-playlist-toolbar";
import { usePlaylistFilters } from "@/lib/music/use-playlist-filters";
import { LibraryTrackList } from "@/components/music/music-library-parts";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { MusicCollectionControls } from "./music-collection-controls";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Heart,
  ListMusic,
  LoaderCircle,
  Plus,
  RefreshCw,
} from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { connectSource } from "@/lib/music/catalog";
import {
  createSpotifyPlaylist,
  importSpotifyCollection,
  loadSpotifyLibraryPage,
  spotifyLibraryErrorKey,
  type SpotifyLibraryPage,
  type SpotifyLibraryPlaylist,
} from "@/lib/music/spotify-library";
import type { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { registerMusicQueueOrigin } from "@/lib/music/playback-origin";
import { openUrl } from "@/lib/window";
import { useMusicConnections } from "./music-connections";
import { MusicServiceLogo } from "./music-service-logo";
import { useMusicSourcePicker } from "./music-source-picker";
import "./music-spotify-library.css";

export function MusicSpotifyLibrary({
  onImported,
  active = true,
  initialKind = "playlists",
}: {
  onImported: (playlist: MusicPlaylist) => void;
  active?: boolean;
  initialKind?: "playlists" | "liked";
}) {
  const t = useT();
  const connections = useMusicConnections();
  const account = connections.connections.find((connection) => connection.id === "spotify");
  const connected = account?.status === "connected";
  const { openSourcePicker } = useMusicSourcePicker();
  const [kind, setKind] = useState<"playlists" | "liked">(initialKind);
  const [selected, setSelected] = useState<SpotifyLibraryPlaylist | null>(null);
  const [page, setPage] = useState<SpotifyLibraryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState<"import" | "create" | "connect" | null>(null);
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const pages = useRef(new Map<string, SpotifyLibraryPage>());
  const cacheIdentity = useRef("");
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const importAbort = useRef<AbortController | null>(null);
  const origin = useRef<{ id: string; scroll: Element | null; top: number } | null>(null);
  const selectedId = selected?.id;
  const player = useMusicPlayback();
  const collection = usePlaylistFilters(selectedId ?? kind, page?.tracks, { addedAt: page?.trackAddedAt, recentFirst: kind === "liked" && !selected });
  const filteringCollection = collection.active || collection.filters.sort !== "default";


  const more = useRef<HTMLButtonElement | null>(null);
  const read = useCallback(
    async (offset = 0, append = false) => {
      const run = ++generation.current;
      setLoading(true);
      setFailure("");
      try {
        const next = await loadSpotifyLibraryPage(
          selectedId ? "playlist" : kind,
          offset,
          selectedId,
        );
        if (run !== generation.current) return;
        const key = selectedId ?? kind;
        const previous = pages.current.get(key);
        const result =
          append && previous
            ? {
                ...next,
                tracks: [...previous.tracks, ...next.tracks],
                trackAddedAt: { ...previous.trackAddedAt, ...next.trackAddedAt },
                playlists: [...previous.playlists, ...next.playlists],
                skipped: previous.skipped + next.skipped,
              }
            : next;
        pages.current.set(key, result);
        setPage(result);
      } catch (error) {
        if (run === generation.current) setFailure(spotifyLibraryErrorKey(error));
      } finally {
        if (run === generation.current) setLoading(false);
      }
    },
    [kind, selectedId],
  );

  useEffect(() => {
    const identity = `${connected}:${account?.account}:${refresh}`;
    if (cacheIdentity.current !== identity) {
      pages.current.clear();
      cacheIdentity.current = identity;
    }
    const cached = pages.current.get(selectedId ?? kind);
    setPage(cached ?? null);
    setFailure("");
    setNotice("");
    if (connected && !cached) void read();
    else setLoading(false);
    return () => {
      generation.current += 1;
      importAbort.current?.abort();
    };
  }, [connected, account?.account, read, refresh, selectedId, kind]);

  useEffect(() => {
    const node = more.current;
    const next = page?.nextOffset;
    if (!node || next == null || loading || working || failure || filteringCollection) return;
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void read(next, true);
      },
      { rootMargin: "320px" },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [page?.nextOffset, loading, working, read, failure, filteringCollection]);

  useEffect(() => {
    if (active && filteringCollection && page?.nextOffset != null && !loading && !working && !failure) void read(page.nextOffset, true);
  }, [active, filteringCollection, page?.nextOffset, loading, working, failure, read]);

  useEffect(() => {
    const changed = () => setRefresh((value) => value + 1);
    window.addEventListener("harbor:spotify-library-changed", changed);
    return () => window.removeEventListener("harbor:spotify-library-changed", changed);
  }, []);

  const back = useCallback(() => {
    setSelected(null);
  }, []);

  useEffect(() => {
    const previous = origin.current;
    if (selected || !previous || !page?.playlists.some((playlist) => playlist.id === previous.id))
      return;
    const frame = requestAnimationFrame(() => {
      if (previous.scroll) previous.scroll.scrollTop = previous.top;
      const trigger = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>("[data-spotify-playlist-id]") ?? []),
      ].find((button) => button.dataset.spotifyPlaylistId === previous.id);
      (trigger ?? heading.current)?.focus({ preventScroll: true });
      origin.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, page]);

  useSectionBack(back, active && !!selected);
  useEffect(() => {
    if (!active || !selected) return;
    heading.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.target instanceof HTMLInputElement ||
        document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      back();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [active, selected, back]);

  const openPlaylist = (playlist: SpotifyLibraryPlaylist, button: HTMLButtonElement) => {
    let scroll: Element | null = button.parentElement;
    while (scroll && !/(auto|scroll)/.test(getComputedStyle(scroll).overflowY))
      scroll = scroll.parentElement;
    origin.current = { id: playlist.id, scroll, top: scroll?.scrollTop ?? 0 };
    setSelected(playlist);
  };

  const reconnect = async () => {
    setWorking("connect");
    setFailure("");
    try {
      connections.apply(await connectSource("spotify"));
      setRefresh((value) => value + 1);
    } catch (error) {
      setFailure(spotifyLibraryErrorKey(error));
    } finally {
      setWorking(null);
    }
  };

  const importCollection = async () => {
    const controller = new AbortController();
    importAbort.current = controller;
    setWorking("import");
    setFailure("");
    setNotice("");
    setProgress(0);
    try {
      const result = await importSpotifyCollection({
        kind: selected ? "playlist" : "liked",
        playlistId: selected?.id,
        name: selected?.name ?? t("music.spotifyLibrary.liked"),
        signal: controller.signal,
        onProgress: setProgress,
      });
      onImported(result.playlist);
      setNotice(
        t("music.spotifyLibrary.imported", {
          count: result.playlist.tracks.length,
          name: result.playlist.name,
        }) +
          (result.skipped
            ? ` ${t("music.spotifyLibrary.skipped", { count: result.skipped })}`
            : ""),
      );
    } catch (error) {
      if (!controller.signal.aborted) setFailure(spotifyLibraryErrorKey(error));
    } finally {
      importAbort.current = null;
      setWorking(null);
    }
  };

  const create = async () => {
    if (!name.trim() || working) return;
    setWorking("create");
    setFailure("");
    setNotice("");
    try {
      const playlist = await createSpotifyPlaylist(name);
      setName("");
      await read();
      setNotice(t("music.spotifyLibrary.created", { name: playlist.name }));
    } catch (error) {
      setFailure(spotifyLibraryErrorKey(error));
    } finally {
      setWorking(null);
    }
  };

  const title = selected?.name ?? t("music.spotifyLibrary.title");
  const play = (track: MusicTrack, queue: MusicTrack[]) => {
    registerMusicQueueOrigin(queue, {
      kind: "spotify", id: selected?.id ?? "spotify:liked",
      name: selected?.name ?? t("music.spotifyLibrary.liked"),
      collection: selected ? "playlist" : "liked", nextOffset: page?.nextOffset ?? null,
    });
    openSourcePicker(track, queue);
  };
  const items = selected || kind === "liked" ? (page?.tracks ?? []) : (page?.playlists ?? []);
  const needsPermission =
    failure === "music.spotifyLibrary.permission" ||
    failure === "music.spotifyLibrary.reconnectNeeded" ||
    (!failure && page && !page.canCreate);
  return (
    <section ref={root} className="music-spotify-library">
      <header className="music-spotify-header">
        <MusicServiceLogo source="spotify" size={32} />
        <div className="min-w-0 flex-1">
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {selected
              ? selected.subtitle
              : connected
                ? account?.account
                : t("music.spotifyLibrary.body")}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            className="music-spotify-icon"
            disabled={loading || !!working}
            onClick={() => void read()}
            aria-label={t("music.spotifyLibrary.refresh")}
          >
            <RefreshCw size={18} />
          </button>
        )}
      </header>
      {!connected ? (
        <button
          type="button"
          className="music-spotify-button"
          onClick={() => connections.openConnections("spotify")}
        >
          {t("music.spotifyLibrary.connect")}
        </button>
      ) : (
        <>
          {!selected && (
            <div
              className="music-spotify-actions"
              role="group"
              aria-label={t("music.spotifyLibrary.title")}
            >
              <button
                type="button"
                className="music-spotify-button"
                aria-pressed={kind === "playlists"}
                onClick={() => setKind("playlists")}
              >
                <ListMusic size={17} />
                {t("music.spotifyLibrary.playlists")}
              </button>
              <button
                type="button"
                className="music-spotify-button"
                aria-pressed={kind === "liked"}
                onClick={() => setKind("liked")}
              >
                <Heart size={17} />
                {t("music.spotifyLibrary.liked")}
              </button>
            </div>
          )}
          {(selected || kind === "liked") && (
            <div className="music-spotify-import">
              <p className="text-sm text-ink-muted">{t("music.spotifyLibrary.importBody")}</p>
              <div className="music-spotify-actions">
                <button
                  type="button"
                  className="music-spotify-button"
                  disabled={!!working || !page?.tracks.length}
                  onClick={() => void importCollection()}
                >
                  <Download size={17} />
                  {t("music.spotifyLibrary.import")}
                </button>
                {selected && (
                  <button
                    type="button"
                    className="music-spotify-text"
                    onClick={() =>
                      openUrl(`https://open.spotify.com/playlist/${selected.id.split(":").pop()}`)
                    }
                  >
                    <ExternalLink size={16} />
                    {t("music.spotifyLibrary.open")}
                  </button>
                )}
              </div>
            </div>
          )}
          {needsPermission && (
            <div className="music-spotify-permission">
              <p>
                {t(
                  failure === "music.spotifyLibrary.reconnectNeeded"
                    ? failure
                    : "music.spotifyLibrary.permission",
                )}
              </p>
              <button
                type="button"
                className="music-spotify-button"
                disabled={!!working}
                onClick={() => void reconnect()}
              >
                {t("music.spotifyLibrary.reconnect")}
              </button>
            </div>
          )}
          {failure && !needsPermission && (
            <div className="music-spotify-permission">
              <p role="alert">{t(failure)}</p>
              <button
                type="button"
                className="music-spotify-button"
                disabled={loading || !!working}
                onClick={() => void read()}
              >
                {t("common.retry")}
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="text-sm text-ink-muted">
              {notice}
            </p>
          )}
          {working === "import" && (
            <div className="music-spotify-actions" role="status">
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
              {t("music.spotifyLibrary.importing", { count: progress })}
              <button
                type="button"
                className="music-spotify-text"
                onClick={() => importAbort.current?.abort()}
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
          {!selected && kind === "playlists" && page?.canCreate && (
            <form
              className="music-spotify-create"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <input
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("music.playlist.namePlaceholder")}
                aria-label={t("music.playlist.nameLabel")}
              />
              <button
                type="submit"
                disabled={!!working || !name.trim()}
                className="music-spotify-button"
              >
                <Plus size={17} />
                {t("music.spotifyLibrary.create")}
              </button>
              <p>{t("music.spotifyLibrary.private")}</p>
            </form>
          )}
          {(selected || kind === "liked") && !!page?.tracks.length && (
            <MusicCollectionControls
              tracks={collection.tracks}
              onPlay={play}
              disabled={!!working}
            />
          )}
          {!selected && kind === "playlists" ? (
            <div className="music-spotify-playlists">
              {page?.playlists.map((playlist) => (
                <article key={playlist.id}>
                  <button
                    type="button"
                    data-spotify-playlist-id={playlist.id}
                    className="music-spotify-playlist"
                    onClick={(event) =>
                      playlist.canRead
                        ? openPlaylist(playlist, event.currentTarget)
                        : openUrl(
                            `https://open.spotify.com/playlist/${playlist.id.split(":").pop()}`,
                          )
                    }
                  >
                    <span className="music-spotify-cover">
                      {playlist.artwork[0] ? (
                        <img src={playlist.artwork[0]} alt="" loading="lazy" />
                      ) : (
                        <ListMusic size={24} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <strong>{playlist.name}</strong>
                      <small>
                        {playlist.canRead ? playlist.subtitle : t("music.spotifyLibrary.readOnly")}
                      </small>
                    </span>
                    {!playlist.canRead && <ExternalLink size={16} className="shrink-0" />}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <>
              <MusicPlaylistToolbar controller={collection} loading={loading} />
              <LibraryTrackList title="" subtitle="" showControls={false} tracks={collection.tracks} view={collection.filters.view}
                likedIds={player.likedIds} selectedPlaylist={null} onPlay={play}
                emptyCopy={t(collection.active ? "music.searchEmpty" : "music.spotifyLibrary.empty")} />
            </>
          )}
          {loading && (
            <p role="status" className="music-spotify-actions text-sm text-ink-muted">
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
              {t("music.loading")}
            </p>
          )}
          {!loading && !failure && page && !items.length && (
            <p className="text-sm text-ink-muted">{t("music.spotifyLibrary.empty")}</p>
          )}
          {page && (
            <footer className="music-spotify-actions">
              <span className="text-xs tabular-nums text-ink-muted">
                {page.total != null
                  ? t("music.spotifyLibrary.loaded", {
                      count: items.length + page.skipped,
                      total: page.total,
                    })
                  : items.length}
              </span>
              {page.nextOffset != null && (
                <button
                  ref={more}
                  type="button"
                  className="music-spotify-button"
                  disabled={loading || !!working}
                  onClick={() => void read(page.nextOffset!, true)}
                >
                  {t(loading ? "music.loading" : "music.library.loadMore")}
                </button>
              )}
            </footer>
          )}
          {!!page?.skipped && (
            <p className="text-xs text-ink-muted">
              {t("music.spotifyLibrary.skipped", { count: page.skipped })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
