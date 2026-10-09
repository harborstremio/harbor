import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, Search, X } from "@/components/icons/music-icons";
import { MusicActionGlyph } from "@/components/music/music-action-feedback";
import { Dropdown } from "@/components/dropdown";
import { MusicCollectionControls } from "@/components/music/music-collection-controls";
import { MusicConnections, MusicConnectionsProvider, useMusicConnections } from "@/components/music/music-connections";
import { MusicNavigateProvider, useMusicNavigate } from "@/components/music/music-navigate";
import { MusicPlaylistPickerProvider, useMusicPlaylistPicker } from "@/components/music/music-playlist-picker";
import { MusicSourcePickerProvider, useMusicSourcePicker } from "@/components/music/music-source-picker";
import { MusicTrackRowsSkeleton } from "@/components/music/music-skeletons";
import { MusicTrackRow } from "@/components/music/music-track-row";
import { playMusic } from "@/lib/music/player";
import { useT } from "@/lib/i18n";
import { activeProfileId } from "@/lib/active-profile-id";
import { addTracksToMusicPlaylist, createMusicPlaylist } from "@/lib/music/library";
import { requestMusicExplore, requestMusicPlaylist } from "@/lib/music/navigation";
import { nowPlayingMatches } from "@/lib/music/now-playing-key";
import { enqueueMusic } from "@/lib/music/player";
import { recordMusicPlaylistPlayback, registerMusicQueueOrigin } from "@/lib/music/playback-origin";
import { refreshMusicRecentContextArtwork } from "@/lib/music/recent-context";
import type { MusicTrack } from "@/lib/music/types";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import { useSectionBack } from "@/lib/section-back";
import { useView } from "@/lib/view";
import { loadSpooktoberMusic, spooktoberAsset, spooktoberSongToTrack, type SpooktoberMusicData, type SpooktoberPlaylistData } from "./spooktober-music";
import "./spooktober-playlist.css";

function navigationTrack(artist: string, album = ""): MusicTrack {
  return { id: `spooktober:${artist}:${album}`, connectorId: "catalog", title: album, artist, album, artwork: "", durationSeconds: 0, durationLabel: "" };
}

/** These are the same source, playlist and connection flows used by the Music view. */
export function SpooktoberMusicProvider({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const { setView } = useView();
  const navigate = useMemo(() => ({
    goToArtist: (name: string, track?: MusicTrack) => {
      setView("music");
      requestMusicExplore({ kind: "artist", track: { ...(track ?? navigationTrack(name)), artist: name } });
    },
    goToAlbum: (album: string, artist: string) => {
      setView("music");
      requestMusicExplore({ kind: "album", track: navigationTrack(artist, album) });
    },
  }), [setView]);
  return (
    <MusicConnectionsProvider active={active}>
      <MusicSourcePickerProvider active={active}>
        <MusicPlaylistPickerProvider active={active}>
          <MusicNavigateProvider value={navigate}>
            <ConnectionPage active={active}>{children}</ConnectionPage>
          </MusicNavigateProvider>
        </MusicPlaylistPickerProvider>
      </MusicSourcePickerProvider>
    </MusicConnectionsProvider>
  );
}

function ConnectionPage({ children, active }: { children: ReactNode; active: boolean }) {
  const { request, closeConnections } = useMusicConnections();
  useSectionBack(closeConnections, active && Boolean(request));
  return (
    <>
      <div hidden={Boolean(request)} className="spooktober-music-content">{children}</div>
      {active && request && (
        <div className="spooktober-connections">
          <MusicConnections focusId={request.focusId} onClose={closeConnections} />
        </div>
      )}
    </>
  );
}

export function useSpooktoberMusicPlayback() {
  const { openSourcePicker } = useMusicSourcePicker();
  const play = useCallback((track: MusicTrack, queue: MusicTrack[] = [track], playlist?: { id: string; title: string }) => {
    // The prefixed ID routes dock/menu navigation back to the festival, separately
    // from native library playlist IDs created when the user saves a copy.
    if (playlist) recordMusicPlaylistPlayback({ id: `spooktober:${playlist.id}`, name: playlist.title, tracks: queue }, queue);
    else registerMusicQueueOrigin(queue, null);
    // The ready callback keeps a music video on the dock instead of handing it to the Music
    // view's watch page, so it stays controllable from the bottom bar and Now Playing.
    openSourcePicker(track, queue, () => {});
  }, [openSourcePicker]);
  const playVideo = useCallback((track: MusicTrack) => {
    registerMusicQueueOrigin([track], null);
    void playMusic(track, [track]).catch(() => {});
  }, []);
  return { play, playVideo };
}

const savedCopies = new Map<string, string>();
const unfinishedCopies = new Map<string, string>();

export function SpooktoberPlaylist({ playlistId, onBack, active = true, focusTrackId }: { playlistId: string; onBack: () => void; active?: boolean; focusTrackId?: string }) {
  const t = useT();
  const { setView } = useView();
  const navigate = useMusicNavigate();
  const { play } = useSpooktoberMusicPlayback();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const now = useMusicNowPlaying();
  const [data, setData] = useState<SpooktoberMusicData | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const saveKey = `${activeProfileId()}:${playlistId}`;
  const playlist = data?.playlists.find((item) => item.id === playlistId);
  const title = playlist ? t(`spooktober.playlist.${playlist.id}.title`) : "Spooktober";

  useSectionBack(onBack, active);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void loadSpooktoberMusic().then((next) => {
      if (cancelled) return;
      setData(next);
      const songs = new Map(next.songs.map((song) => [song.id, song]));
      refreshMusicRecentContextArtwork(
        new Map(next.playlists.map((entry) => [
          `spooktober:${entry.id}`,
          entry.songIds
            .map((id) => songs.get(id))
            .filter((song): song is NonNullable<typeof song> => Boolean(song?.poster))
            .slice(0, 8)
            .map((song) => spooktoberAsset(song.poster)),
        ])),
      );
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    generation.current += 1;
    setQuery("");
    setSort("default");
    setSaving(false);
    setSaveFailed(false);
    setSavedId(savedCopies.get(saveKey) ?? null);
    return () => { generation.current += 1; };
  }, [saveKey]);
  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [playlistId, playlist, active]);

  const tracks = useMemo(() => {
    if (!data || !playlist) return [];
    const songs = new Map(data.songs.map((song) => [song.id, song]));
    return playlist.songIds.map((id) => spooktoberSongToTrack(songs.get(id)!));
  }, [data, playlist]);
  const positions = useMemo(() => new Map(tracks.map((track, index) => [track.id, index + 1])), [tracks]);
  useEffect(() => {
    if (!active || !focusTrackId || !tracks.length) return;
    setQuery("");
    setSort("default");
    const frame = requestAnimationFrame(() => {
      const row = [...(root.current?.querySelectorAll<HTMLElement>("[data-spooktober-track]") ?? [])]
        .find((item) => item.dataset.spooktoberTrack === focusTrackId);
      row?.scrollIntoView({ block: "center", behavior: "instant" });
      row?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focusTrackId, tracks]);
  const filtered = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    const result = tracks.filter((track) => terms.every((term) => normalize(`${track.title} ${track.artist} ${track.album ?? ""}`).includes(term)));
    if (sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "duration") result.sort((a, b) => a.durationSeconds - b.durationSeconds);
    return result;
  }, [tracks, query, sort]);
  const start = (track: MusicTrack, queue: MusicTrack[]) => play(track, queue, { id: playlistId, title });
  const minutes = Math.floor(tracks.reduce((sum, track) => sum + track.durationSeconds, 0) / 60);
  const length = minutes >= 60
    ? t("music.playlist.totalHours", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
    : t("music.playlist.totalMinutes", { minutes });
  const savePlaylist = async () => {
    if (savedId) { setView("music"); requestMusicPlaylist(savedId); return; }
    if (saving || !tracks.length) return;
    const run = generation.current;
    setSaving(true);
    setSaveFailed(false);
    try {
      let id = unfinishedCopies.get(saveKey);
      if (!id) {
        id = (await createMusicPlaylist(title)).id;
        unfinishedCopies.set(saveKey, id);
      }
      if (`${activeProfileId()}:${playlistId}` !== saveKey) throw new Error("Profile changed");
      await addTracksToMusicPlaylist(id, tracks);
      unfinishedCopies.delete(saveKey);
      savedCopies.set(saveKey, id);
      if (generation.current === run) setSavedId(id);
    } catch {
      if (generation.current === run) setSaveFailed(true);
    } finally {
      if (generation.current === run) setSaving(false);
    }
  };

  return (
    <article ref={root} className="spooktober-playlist" data-playlist={playlistId} aria-labelledby="spooktober-playlist-title" inert={!active}>
      {failed || (data && !playlist) ? (
        <div role="alert" className="spooktober-playlist-state"><p>{t("music.error.load")}</p><button type="button" onClick={() => setRevision((value) => value + 1)}>{t("common.retry")}</button></div>
      ) : !playlist || !data ? <MusicTrackRowsSkeleton /> : (
        <>
          <header className="spooktober-playlist-hero">
            <div className="spooktober-playlist-intro">
              <p className="spooktober-playlist-eyebrow">{t("spooktober.playlist.eyebrow")}</p>
              <h1 id="spooktober-playlist-title" tabIndex={-1} ref={heading}>{title}</h1>
              <p className="spooktober-playlist-description">{t(`spooktober.playlist.${playlist.id}.description`)}</p>
              <p className="spooktober-playlist-facts"><span>{t("music.trackCount", { count: tracks.length })}</span><span aria-hidden>·</span><span>{length}</span></p>
              <MusicCollectionControls tracks={tracks} onPlay={start} extra={
                <button className="spooktober-playlist-save music-action-button" data-music-action-state={savedId ? "done" : saving ? "busy" : "idle"} type="button" disabled={saving} aria-busy={saving} onClick={() => void savePlaylist()}>
                  <MusicActionGlyph state={savedId ? "done" : saving ? "busy" : "idle"} idle={<Plus size={17} />} size={17} identity={saveKey} />
                  {t(savedId ? "spooktober.playlist.saved" : "spooktober.playlist.save")}
                </button>
              } />
              <span role="status" className="sr-only">{savedId ? t("music.similar.saved") : ""}</span>
              {saveFailed && <p role="alert" className="spooktober-playlist-error">{t("music.action.error")}</p>}
            </div>
            <PlaylistArt playlist={playlist} data={data} />
          </header>
          <section className="spooktober-playlist-tracks" aria-labelledby="spooktober-track-heading">
            <div className="spooktober-playlist-toolbar">
              <div className="spooktober-playlist-count"><h2 id="spooktober-track-heading">{t("music.search.tracks")}</h2><span role="status" aria-live="polite">{t("music.trackCount", { count: filtered.length })}</span></div>
              <div className="spooktober-playlist-filters">
                <label className="spooktober-playlist-search"><Search size={16} aria-hidden /><input type="search" aria-label={t("music.filter.tracks")} placeholder={t("music.filter.tracks")} value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" onClick={() => setQuery("")} aria-label={t("music.search.clear")}><X size={15} aria-hidden /></button>}</label>
                <Dropdown key={String(active)} value={sort} onChange={setSort} ariaLabel={t("music.sort.label")} options={["default", "title", "duration"].map((value) => ({ value, label: t(`music.sort.${value}`) }))} size="sm" />
              </div>
            </div>
            <ol className="spooktober-playlist-rows">
              {filtered.map((track) => {
                const current = nowPlayingMatches(now, track);
                return <li key={track.id} data-spooktober-track={track.id}>{active ? <MusicTrackRow track={track} index={positions.get(track.id)} onPlay={() => start(track, filtered)} onAddToQueue={() => enqueueMusic(track)} onAddToPlaylist={() => openPlaylistPicker(track)} onGoToArtist={() => navigate.goToArtist(track.artist, track)} onGoToAlbum={() => { setView("music"); requestMusicExplore({ kind: "album", track }); }} onMoreLikeThis={() => { setView("music"); requestMusicExplore({ kind: "similar", track }); }} showDuration nowPlaying={current} paused={now.phase === "paused"} loading={current && now.phase === "resolving"} /> : <div className="h-14" aria-hidden />}</li>;
              })}
            </ol>
            {!filtered.length && <p className="spooktober-playlist-state">{t("music.searchEmpty")}</p>}
          </section>
        </>
      )}
    </article>
  );
}

function PlaylistArt({ playlist, data }: { playlist: SpooktoberPlaylistData; data: SpooktoberMusicData }) {
  return <div className="spooktober-playlist-art" aria-hidden>
    {playlist.art.map((art, index) => <img key={art} className={`spooktober-mix-prop prop-${index}`} src={spooktoberAsset(`assets/art/${art}.svg`)} alt="" draggable={false} />)}
    {playlist.coverIds.map((id, index) => {
      const song = data.songs.find((item) => item.id === id);
      return song ? <img key={id} className={`spooktober-mix-cover cover-${index}`} src={spooktoberAsset(song.poster)} alt="" draggable={false} /> : null;
    })}
  </div>;
}
