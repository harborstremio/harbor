import { useEffect, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { ArrowLeft, ArrowRight, Play, Radio, RotateCcw } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { musicExploreSeeds, readListeningAffinity } from "@/lib/music/listening-affinity";
import { activeProfileId } from "@/lib/active-profile-id";
import { searchMusicVideos } from "@/lib/music/video-discovery";
import { filterBlockedTracks } from "@/lib/music/artist-blocks";
import { MusicPerformanceArtist } from "@/components/music/music-performance-artist";
import { isMusicRecentHidden } from "@/lib/music/hidden-recents";
import type { MusicTrack } from "@/lib/music/types";
import "./music-performance-spotlight.css";

// Editorial search routes resolve to actual playable video metadata at runtime.
export const MUSIC_PERFORMANCES = [
  { name: "Live Aid", query: "Live Aid 1985 live performances official" },
  { name: "MTV VMAs", query: "MTV VMAs iconic live performances official" },
  { name: "MTV Unplugged", query: "Nirvana Where Did You Sleep Last Night MTV Unplugged 1993" },
  { name: "Tiny Desk · Afrofusion", query: "Burna Boy NPR Music Tiny Desk Concert" },
  { name: "Tiny Desk · Brasil", query: "Ludmilla Tiny Desk Concert NPR Music" },
  { name: "Tiny Desk · K-pop", query: "BTS Tiny Desk Home Concert NPR Music" },
  { name: "Tiny Desk · Flamenco", query: "C Tangana Tiny Desk Home Concert NPR Music" },
  { name: "Coke Studio", query: "Coke Studio Pasoori Ali Sethi Shae Gill" },
  { name: "COLORS", query: "Little Simz A COLORS SHOW" },
  { name: "Boiler Room · Amapiano", query: "Major League DJz Boiler Room amapiano" },
  { name: "Montreux Jazz Festival", query: "Nina Simone Montreux 1976 live official" },
  { name: "Rock in Rio", query: "Sepultura Rock in Rio live official" },
];
export function MusicPerformanceSpotlight({ active, onWatch }: { active: boolean; onWatch: (track: MusicTrack, queue: MusicTrack[]) => void }) {
  const t = useT(), player = useMusicPlayback();
  const seeds = musicExploreSeeds(filterBlockedTracks(player.recents.filter(track => !isMusicRecentHidden(track.id)), "show"), filterBlockedTracks(player.likedTracks, "show"), readListeningAffinity(activeProfileId()));
  const [scene, setScene] = useState(() => String(Math.floor(Date.now() / 86_400_000) % MUSIC_PERFORMANCES.length));
  const [index, setIndex] = useState(0), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ query: string; tracks: MusicTrack[]; error: boolean } | null>(null);
  const seed = seeds[0];
  const query = scene === "personal" && seed ? `${seed.artist} live performance official` : MUSIC_PERFORMANCES[Number(scene)]?.query ?? MUSIC_PERFORMANCES[0].query;
  useEffect(() => {
    if (!active) return;
    let live = true; setResult(null); setIndex(0);
    searchMusicVideos(query, retry > 0, true, 6, scene === "personal" && seed ? seed.artist : "").then(tracks => { if (live) setResult({ query, tracks, error: false }); })
      .catch(() => { if (live) setResult({ query, tracks: [], error: true }); });
    return () => { live = false; };
  }, [query, active, retry]);
  const current = result?.query === query ? result : null;
  const track = current?.tracks[index];
  const sceneName = scene === "personal" && seed ? seed.artist : MUSIC_PERFORMANCES[Number(scene)]?.name;
  return <section className="music-performance" aria-label={t("music.explore.performance")}>
    <div className="music-performance-art" aria-busy={!current}>
      {track?.artwork ? <img src={track.artwork} alt="" decoding="async"/> : <Radio size={44} aria-hidden/>}
      {track && <button type="button" aria-label={t("music.videos.watch", { title: track.title })} onClick={() => onWatch(track,current!.tracks)}><Play size={28} aria-hidden/></button>}
    </div>
    <div className="music-performance-copy">
      <div className="music-performance-top"><span>{t("music.explore.performance")}</span><Dropdown size="sm" value={scene} ariaLabel={t("music.explore.stage")}
        options={[...MUSIC_PERFORMANCES.map((item, at) => ({ value: String(at), label: item.name })), ...(seed ? [{ value: "personal", label: t("music.explore.liveFrom", { artist: seed.artist }) }] : [])]}
        onChange={value => { setScene(value); setRetry(0); }}/></div>
      <h3>{track?.title ?? sceneName}</h3>
      {track ? <MusicPerformanceArtist track={track}/> : <p>{t("music.explore.performanceHint")}</p>}
      <div className="music-performance-actions">
        {!track && (current ? <button type="button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={17} aria-hidden/>{t("common.retry")}</button>
          : <span role="status">{t("music.videos.loading")}</span>)}
        {current && !track && <span role="status">{t(current.error ? "music.videos.error" : "music.videos.empty")}</span>}
        {!!current?.tracks.length && <div><button type="button" aria-label={t("common.previous")} disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ArrowLeft className="dir-icon" size={18}/></button>
          <span>{index + 1} / {current.tracks.length}</span><button type="button" aria-label={t("common.next")} disabled={index >= current.tracks.length - 1} onClick={() => setIndex(value => value + 1)}><ArrowRight className="dir-icon" size={18}/></button></div>}
      </div>
    </div>
  </section>;
}
