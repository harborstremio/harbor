import { musicGenreName } from "@/lib/music/genre-catalog";
import { useEffect, useRef, useState } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useFloatingBackShown } from "@/chrome/floating-back";
import { ChevronLeft } from "@/components/icons/music-icons";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicBillboardCharts, MusicDiscoveryChartRow } from "@/components/music/music-discovery-charts";
import { MusicDiscoveryIcon } from "@/components/music/music-discovery-icon";
import { MusicTasteIcon } from "@/components/music/music-taste-icon";
import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { useT } from "@/lib/i18n";
import { loadMusicDiscoveryChart, loadMusicGenreSelection, type MusicGenreSelection } from "@/lib/music/discovery";
import { type MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { MusicGenreBrowser } from "./music-genre-browser";
import { MUSIC_GENRE_ARTWORK } from "@/lib/music/genre-artwork";
import { EDITORIAL_SCENES } from "@/lib/music/genre-editorial";
import { isPlaylistScene } from "@/lib/music/genre-playlist-pool";
import { MusicExploreRecommendations } from "./music-explore-recommendations";
import { MusicPerformanceSpotlight } from "./music-performance-spotlight";
import { MusicEventDiscovery } from "./music-event-discovery";
import { MusicGenreArtists } from "./music-genre-artists";
import { MusicGenreScenes } from "./music-genre-scenes";
import { MusicGenreVideos } from "./music-genre-videos";
import { MusicGenreChannels } from "./music-genre-channels";
import { MusicGenreDeep } from "./music-genre-deep";
import { MusicXxlFreshmen } from "./music-xxl-freshmen";
import { MusicRockHall } from "./music-rock-hall";
import "./music-discovery.css";

export type MusicGenreEntry = MusicDiscoveryGenre;

// The Hall inducts across rock's whole family tree, so every rock scene page earns the row.
const ROCK_HALL_SLUGS = new Set(["rock", "classic-rock", "hard-rock", "punk", "indie-rock",
  "alternative", "grunge", "psychedelic-rock", "progressive-rock", "southern-rock", "glam-rock",
  "garage-rock", "blues-rock", "new-wave", "post-punk", "heartland-rock", "rockabilly"]);
let genreOrigin: { id: number; top: number; offset: number } | null = null;
const EMPTY: MusicGenreSelection = { tracks: [], positions: [], artists: [], playlists: [] };
export function MusicGenres({ onOpen, genre, onGenre, onBillboard, onTastes, onWatch, onPlay, active = true }: {
  onBillboard?: (chartId?: string) => void;
  onTastes: () => void;
  onWatch: (track: MusicTrack, queue: MusicTrack[]) => void;
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
  active?: boolean;
  genre: MusicGenreEntry | null;
  onGenre: (genre: MusicGenreEntry | null) => void;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
}) {
  const t = useT();
  const [chart, setChart] = useState<MusicGenreSelection>(EMPTY);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const floatingBack = useFloatingBackShown();
  useEffect(() => {
    let live = true;
    setLoading(true); setError(false); setChart(EMPTY);
    (genre ? loadMusicGenreSelection(genre.id) : loadMusicDiscoveryChart().then(value => ({ ...value, playlists: [] })))
      .then(value => { if (live) setChart(value); })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [genre?.id, retry]);
  useEffect(() => {
    if (genre || loading || !genreOrigin) return;
    const saved = genreOrigin;
    const scroll = root.current?.closest<HTMLElement>("[data-music-view]");
    const restore = () => {
      const button = root.current?.querySelector<HTMLButtonElement>(`[data-music-genre="${saved.id}"]`);
      if (scroll) scroll.scrollTop = button ? scroll.scrollTop + button.getBoundingClientRect().top - scroll.getBoundingClientRect().top - saved.offset : saved.top;
      button?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(restore);
    // Cached video shelves can settle one frame after the genre grid returns.
    const observer = new ResizeObserver(restore);
    if (root.current) observer.observe(root.current);
    const stop = () => { observer.disconnect(); genreOrigin = null; };
    const timer = window.setTimeout(stop, 1500);
    for (const event of ["wheel", "pointerdown", "keydown"]) scroll?.addEventListener(event, stop, { once: true });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); observer.disconnect(); for (const event of ["wheel", "pointerdown", "keydown"]) scroll?.removeEventListener(event, stop); };
  }, [genre, loading]);
  const selectGenre = (selected: MusicGenreEntry) => {
    const scroll = root.current?.closest<HTMLElement>("[data-music-view]");
    const button = root.current?.querySelector(`[data-music-genre="${selected.id}"]`);
    if (!genre) genreOrigin = { id: selected.id, top: scroll?.scrollTop ?? 0, offset: (button?.getBoundingClientRect().top ?? 0) - (scroll?.getBoundingClientRect().top ?? 0) };
    onGenre(selected); scroll?.scrollTo({ top: 0 });
    requestAnimationFrame(() => (document.querySelector<HTMLElement>("[data-floating-back]") ?? root.current?.querySelector<HTMLButtonElement>(".music-discovery-back"))?.focus({ preventScroll: true }));
  };
  const popular = genre && !genre.deezerId && genre.slug !== "ukrainian-wartime" ? chart.tracks.filter(track => chart.popularity?.[track.id]).sort((a,b) => (chart.popularity?.[b.id] ?? 0) - (chart.popularity?.[a.id] ?? 0)).slice(0,24) : [];
  const popularIds = new Set(popular.map(track => track.id));
  const selections = genre && !genre.deezerId ? chart.tracks.filter(track => !popularIds.has(track.id)) : chart.tracks;
  return <section ref={root} className="music-discovery">
    {genre ? <>
      {!floatingBack && <button className="music-discovery-back" type="button" onClick={() => onGenre(null)}><ChevronLeft className="dir-icon" size={18} aria-hidden />{t("music.explore.back")}</button>}
      <header className="music-discovery-hero"><img src={MUSIC_GENRE_ARTWORK[genre.id]} alt=""/><div><h2>{musicGenreName(genre, t)}</h2><p><MusicDiscoveryIcon genreId={genre.id}/>{t(genre.deezerId ? "music.explore.chartSource" : !isPlaylistScene(genre.slug) && EDITORIAL_SCENES[genre.slug] ? "music.explore.editorialSource" : "music.explore.selectionSource")}</p></div></header>
    </> : <>
      <header className="music-explore-heading"><h2>{t("music.discover")}</h2><HoverTooltip label={t("music.taste.choose")} align="end"><button type="button" className="music-explore-tastes" aria-label={t("music.taste.choose")} onClick={onTastes}><MusicTasteIcon /></button></HoverTooltip></header>
      <MusicEventDiscovery onWatch={onWatch} active={active}/>
      <MusicPerformanceSpotlight onWatch={onWatch} active={active}/>
      <MusicVideoDiscovery active={active} onWatch={onWatch}/>
      <MusicExploreRecommendations active={active} onOpen={onOpen}/>
    </>}
    {genre && <MusicGenreScenes genre={genre} onSelect={selectGenre}/>}
    {genre?.slug === "hip-hop" && <MusicXxlFreshmen active={active}/>}
    {ROCK_HALL_SLUGS.has(genre?.slug ?? "") && <MusicRockHall active={active}/>}
    {genre && !genre.deezerId && (loading || popular.length > 0) && <MusicDiscoveryChartRow tracks={popular} positions={popular.map(() => null)} loading={loading} error={false}
      title={t("music.artist.popular")} source={t(isPlaylistScene(genre.slug) ? "music.explore.selectionSource" : EDITORIAL_SCENES[genre.slug] ? "music.explore.editorialSource" : "music.explore.popularitySource")} rowId={`genre:${genre.id}:popular`} onRetry={() => setRetry(value => value + 1)} onOpen={onOpen}/>}
    {(loading || error || selections.length > 0) && <MusicDiscoveryChartRow tracks={selections} positions={genre && !genre.deezerId ? selections.map(() => null) : chart.positions} loading={loading} error={error}
      genreId={genre?.id} title={genre && !genre.deezerId ? t("music.explore.selections") : undefined}
      onRetry={() => setRetry(value => value + 1)} onOpen={onOpen}/>}
    {genre ? <>
      <MusicGenreArtists key={genre.id} genreId={genre.id} artists={chart.artists} onOpen={onOpen}/>
      {!loading && <MusicGenreVideos key={`videos:${genre.id}`} genre={genre} artists={chart.artists} active={active} onWatch={onWatch}/>}
      {!loading && <MusicGenreChannels key={`channels:${genre.id}`} genre={genre} active={active} onWatch={onWatch}/>}
      {!!chart.albums?.length && <MusicCatalogRow row={{ id: `genre:${genre.id}:albums`, title: "music.explore.sceneAlbums", titleLiteral: false, layout: "covers", source: "deezer", items: chart.albums.slice(0,24) }} playable onOpen={item => onOpen(item, chart.albums ?? [])}/>}
      {!!chart.playlists.length && <MusicCatalogRow row={{ id: `genre:${genre.id}:playlists`, title: "music.search.playlists", titleLiteral: false, layout: "covers", source: "deezer", items: chart.playlists }} playable onOpen={item => onOpen(item, chart.playlists)}/>}
      {!loading && <MusicGenreDeep key={`deep:${genre.id}`} genre={genre} active={active} onOpen={onOpen} onPlay={onPlay}/>}
    </> : <>
      <MusicBillboardCharts onOpen={onOpen} onBrowse={onBillboard}/>
      <section className="flex flex-col gap-4" data-explore-genres><MusicSectionHead title={t("music.explore.genres")} subtitle={t("music.explore.sceneHint")}/><MusicGenreBrowser onSelect={selectGenre}/></section>
    </>}
  </section>;
}
