import { musicGenreName } from "@/lib/music/genre-catalog";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "@/components/icons/music-icons";
import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { useT } from "@/lib/i18n";
import type { MusicArtistRef, MusicTrack } from "@/lib/music/types";
import type { MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import { musicVideoQuery } from "@/lib/music/video-discovery";
import { loadGenreArtistRoster } from "@/lib/music/genre-artist-roster";
import { HIP_HOP_ARTIST_SEEDS } from "@/lib/music/genre-artist-seeds";
import { EDITORIAL_SCENES } from "@/lib/music/genre-editorial";
import { resolveArtist } from "@/lib/music/artist-authority";

function ArtistFilter({ artist, selected, onSelect }: { artist: MusicArtistRef; selected: boolean; onSelect: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const [artwork, setArtwork] = useState(artist.artwork);
  useEffect(() => {
    if (artwork || !button.current) return;
    let live = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void resolveArtist(artist.name).then(result => { if (live) setArtwork(result.canonical?.artwork); }).catch(() => {});
    }, { rootMargin: "80px" });
    observer.observe(button.current);
    return () => { live = false; observer.disconnect(); };
  }, [artist.name, artwork]);
  return <button ref={button} type="button" aria-pressed={selected} onClick={onSelect}>
    <span className="music-genre-filter-avatar" aria-hidden>{artwork ? <img src={artwork} alt="" loading="lazy"/> : artist.name[0]}</span><span>{artist.name}</span>
  </button>;
}

export function MusicGenreVideos({ genre, artists, active, onWatch }: {
  genre: MusicDiscoveryGenre;
  artists: MusicArtistRef[];
  active: boolean;
  onWatch: (track: MusicTrack, queue: MusicTrack[]) => void;
}) {
  const t = useT();
  const [artist, setArtist] = useState<string | null>(null);
  const [choices, setChoices] = useState(() => {
    const seeds = genre.slug === "hip-hop" ? HIP_HOP_ARTIST_SEEDS : EDITORIAL_SCENES[genre.slug]?.artists;
    return seeds ? seeds.map(name => artists.find(item => item.name.toLowerCase() === name.toLowerCase()) ?? { id: `scene:${name}`, name, connectorId: "catalog" }) : artists;
  });
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [ended, setEnded] = useState(genre.slug === "ukrainian-wartime");
  const cursor = useRef(0), loading = useRef(false), alive = useRef(true);
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const more = useCallback(async () => {
    if (loading.current || ended) return;
    loading.current = true; setBusy(true); setFailed(false);
    try {
      const page = await loadGenreArtistRoster(genre.id, cursor.current);
      if (!alive.current) return;
      setChoices(previous => { const names = new Set(previous.map(item => item.name.toLowerCase())); return [...previous, ...page.artists.filter(item => { const name = item.name.toLowerCase(); if (names.has(name)) return false; names.add(name); return true; })]; });
      if (page.next !== null) cursor.current = page.next; else setEnded(true);
    } catch { if (alive.current) setFailed(true); }
    finally { loading.current = false; if (alive.current) setBusy(false); }
  }, [choices, ended, genre.id]);
  const measure = useCallback(() => {
    const el = rail.current; if (!el) return;
    const left = Math.abs(el.scrollLeft), remaining = el.scrollWidth - el.clientWidth - left;
    setEdges({ start: left < 1, end: remaining < 1 });
  }, []);
  useEffect(() => { measure(); const observer = new ResizeObserver(measure); if (rail.current) observer.observe(rail.current); return () => observer.disconnect(); }, [choices, measure]);
  const move = (step: number) => { const el = rail.current; if (el) el.scrollBy({ left: (getComputedStyle(el).direction === "rtl" ? -1 : 1) * step * el.clientWidth * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); };
  return <MusicVideoDiscovery kinds={["videos", "concerts", "interviews"]} subject={artist ?? genre.name} filterSubject={artist ?? ""}
    queryForKind={kind => !artist && genre.slug === "ukrainian-wartime"
      ? kind === "interviews" ? "OTOY YARMAK військовий реп інтерв'ю" : kind === "concerts" ? "український військовий реп наживо" : "український військовий реп офіційний кліп"
      : !artist && kind === "interviews" ? `${genre.name} artists full interview` : musicVideoQuery(kind, artist ?? genre.name)}
    active={active} onWatch={onWatch} headerContent={
      <div className="music-genre-artist-picker">
      <button type="button" aria-label={t("common.previous")} disabled={edges.start} onClick={() => move(-1)}><ArrowLeft size={16} className="dir-icon"/></button>
      <div ref={rail} className="music-genre-video-artists" role="group" aria-label={t("music.search.artists")} onScroll={() => { measure(); const el = rail.current; if (el && el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) < 180 && !failed) void more(); }}>
        <button type="button" aria-pressed={!artist} onClick={() => setArtist(null)}>{musicGenreName(genre, t)}</button>
        {choices.map(item => <ArtistFilter key={item.name} artist={item} selected={artist === item.name} onSelect={() => setArtist(item.name)}/>)}
        {!ended && <button type="button" disabled={busy} onClick={() => { void more(); }}>{busy && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none"/>}{t(failed ? "common.retry" : "music.library.loadMore")}</button>}
      </div>
      <button type="button" aria-label={t("common.next")} disabled={edges.end} onClick={() => move(1)}><ArrowRight size={16} className="dir-icon"/></button>
      </div>
    }/>;
}
