import { MusicPlaylistToolbar } from "@/components/music/music-playlist-toolbar";
import { MusicPlaylistLoading } from "@/components/music/music-skeletons";
import { usePlaylistFilters } from "@/lib/music/use-playlist-filters";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { ChevronDown, ChevronLeft } from "@/components/icons/music-icons";
import { useSectionBack } from "@/lib/section-back";
import { LibraryTrackList, PlaylistHeader } from "@/components/music/music-library-parts";
import { MusicStickyTitle } from "@/components/music/music-sticky-title";
import { useMusicSourcePicker } from "@/components/music/music-source-picker";
import { recordMusicPlaylistPlayback } from "@/lib/music/playback-origin";
import { MusicPlaylistCover } from "@/components/music/music-playlist-cover";
import {
  MusicPlaylistCoverEdit,
  useMusicPlaylistCover,
} from "@/components/music/music-playlist-cover-edit";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import {
  addTrackToMusicPlaylist,
  exportMusicM3u,
  listMusicPlaylists,
  removeTrackFromMusicPlaylist,
  reorderMusicPlaylist,
} from "@/lib/music/library";
import { useT } from "@/lib/i18n";
import { musicTrackIdentity } from "@/lib/music/track-identity";
import type { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import "./music-playlist-page.css";

function PlaylistArt({ playlist }: { playlist: MusicPlaylist }) {
  const custom = useMusicPlaylistCover(playlist.id);
  return (
    <MusicPlaylistCoverEdit playlistId={playlist.id} hasCustom={Boolean(custom)}>
      {custom ? (
        <span className="music-playlist-custom-cover">
          <img src={custom} alt="" draggable={false} />
        </span>
      ) : (
        <MusicPlaylistCover
          artwork={playlist.tracks.map((track) => track.artwork)}
          seed={playlist.id}
          glyphSize={48}
        />
      )}
    </MusicPlaylistCoverEdit>
  );
}

export function MusicPlaylistPage({
  playlistId,
  active = true,
  onBack,
}: {
  playlistId: string;
  active?: boolean;
  onBack: () => void;
}) {
  const t = useT();
  const player = useMusicPlayback();
  const { openSourcePicker } = useMusicSourcePicker();
  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState(false);
  // The tray adds tracks TO this playlist, so the count must be what is still missing,
  // not the playlist's own length, and the title must not repeat the playlist name.
  const addable = useMemo(() => {
    if (!playlist) return 0;
    const held = new Set(playlist.tracks.map((track) => musicTrackIdentity(track)));
    const seen = new Set<string>();
    let count = 0;
    for (const track of [...player.likedTracks, ...player.recents]) {
      const key = musicTrackIdentity(track);
      if (held.has(key) || seen.has(key)) continue;
      seen.add(key);
      count += 1;
    }
    return count;
  }, [playlist, player.likedTracks, player.recents]);
  const heading = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listMusicPlaylists()
      .then((playlists) => {
        if (cancelled) return;
        setPlaylist(playlists.find((item) => item.id === playlistId) ?? null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId, revision]);

  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    window.addEventListener("harbor:music-library-changed", changed);
    return () => window.removeEventListener("harbor:music-library-changed", changed);
  }, []);

  const close = useCallback(() => onBack(), [onBack]);
  useSectionBack(close, active);
  useEffect(() => {
    if (!active) return;
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
      close();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [active, close]);

  const mutate = (run: Promise<MusicPlaylist>) => {
    setWorking(true);
    setError(null);
    void run
      .then(setPlaylist)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const addTrack = (track: MusicTrack) => {
    if (!playlist || working) return;
    mutate(addTrackToMusicPlaylist(playlist.id, track));
  };
  const removeTrack = (track: MusicTrack) => {
    if (!playlist || working) return;
    mutate(removeTrackFromMusicPlaylist(playlist.id, track.id));
  };
  const moveTrack = (track: MusicTrack, toIndex: number) => {
    if (!playlist || working) return;
    mutate(reorderMusicPlaylist(playlist.id, track.id, toIndex));
  };

  const exportM3u = () => {
    if (!playlist || working) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    void (async () => {
      const path = await save({
        defaultPath: playlistFilename(playlist.name),
        filters: [{ name: t("music.m3u.playlist"), extensions: ["m3u"] }],
      });
      if (typeof path !== "string") return;
      await exportMusicM3u(playlist.id, path);
      setNotice(
        t("music.m3u.exportedNotice", { count: playlist.tracks.length, name: playlist.name }),
      );
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const collection = usePlaylistFilters(playlistId, playlist?.tracks, { addedAt: playlist?.trackAddedAt });
  const visibleTracks = collection.tracks;

  if (!loading && !playlist)
    return (
      <section className="music-playlist-page">
        <BackButton label={t("music.watch.back")} onClick={close} />
        <p className="music-library-empty" role="alert">
          {t("music.library.playlistEmpty")}
        </p>
      </section>
    );

  return (
    <section className="music-playlist-page">
      <BackButton label={t("music.watch.back")} onClick={close} />
      {loading && !playlist && <MusicPlaylistLoading />}
      {(error || notice) && (
        <p
          className={`music-library-notice ${error ? "text-danger" : "text-ink-muted"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? notice}
        </p>
      )}
      {playlist && (
        <>
          <MusicStickyTitle revealAfter={heading} title={playlist.name} tracks={visibleTracks} onPlay={(track, queue) => {
            recordMusicPlaylistPlayback(playlist, queue);
            openSourcePicker(track, queue);
          }} />
          <div className="music-library-playlist-hero" ref={heading} tabIndex={-1}>
            <div className="music-library-playlist-art">
              <PlaylistArt playlist={playlist} />
            </div>
            <div className="music-library-playlist-meta">
              <PlaylistHeader
                playlist={playlist}
                playbackTracks={visibleTracks}
                working={working}
                onRenamed={setPlaylist}
                onDeleted={close}
                onError={setError}
                onExport={exportM3u}
              />
              <span>{t("music.card.trackCount", { count: playlist.tracks.length })}</span>
            </div>
          </div>
          <MusicPlaylistToolbar controller={collection} loading={loading} />
          <LibraryTrackList
            showControls={false}
            title=""
            subtitle=""
            view={collection.filters.view}
            tracks={visibleTracks}
            order={playlist.tracks}
            filtering={collection.filtering}
            filterKey={collection.filters.query}
            likedIds={player.likedIds}
            onRemove={removeTrack}
            onMove={collection.active || collection.filters.sort !== "default" ? undefined : moveTrack}
            selectedPlaylist={playlist}
            emptyCopy={t(collection.active ? "music.searchEmpty" : "music.library.playlistEmpty")}
          />
          {(player.likedTracks.length > 0 || player.recents.length > 0) && (
            <details
              className="music-library-add-tracks"
              onToggle={(event) => setAdding(event.currentTarget.open)}
            >
              <summary>
                <span className="music-library-add-art">
                  <MusicPlaylistCover
                    artwork={playlist.tracks.map((track) => track.artwork)}
                    seed={playlist.id}
                    glyphSize={20}
                  />
                </span>
                <span className="music-library-add-copy">
                  <strong>{t("music.library.addTracks")}</strong>
                  <small>{t("music.library.addTracksCount", { count: addable })}</small>
                </span>
                <ChevronDown size={18} className="music-library-add-chev" aria-hidden />
              </summary>
              {adding && (
                <>
                  {player.likedTracks.length > 0 && (
                    <LibraryTrackList
                      title={t("music.library.savedTracks")}
                      subtitle=""
                      tracks={player.likedTracks}
                      likedIds={player.likedIds}
                      onAdd={addTrack}
                      selectedPlaylist={playlist}
                    />
                  )}
                  {player.recents.length > 0 && (
                    <LibraryTrackList
                      title={t("music.library.recent")}
                      subtitle=""
                      tracks={player.recents}
                      likedIds={player.likedIds}
                      onAdd={addTrack}
                      selectedPlaylist={playlist}
                    />
                  )}
                </>
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-music-inner-back
      onClick={onClick}
      className="music-playlist-page-back"
    >
      <ChevronLeft size={17} />
      {label}
    </button>
  );
}

function playlistFilename(name: string): string {
  const safe = name
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "playlist"}.m3u`;
}
