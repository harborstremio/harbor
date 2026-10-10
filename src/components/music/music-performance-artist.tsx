import { useEffect, useState } from "react";
import { resolveArtist } from "@/lib/music/artist-authority";
import { useT } from "@/lib/i18n";
import { useMusicNavigate } from "./music-navigate";
import type { MusicArtistRef, MusicTrack } from "@/lib/music/types";

export function performanceArtistName(track: Pick<MusicTrack,"title"|"artist">): string | null {
  const title = track.title.replace(/^\s*\[[^\]]+\]\s*/, "");
  const candidate = title.split(/\s+(?:live\b|at\b|@|x\s+coachella\b)|\s+[-–—|]\s+/i)[0].trim();
  if (candidate && candidate.length <= 60 && candidate !== title && !/\b(festival|coachella|rolling loud|tomorrowland|live aid|mtv|tiny desk|coke studio|boiler room)\b/i.test(candidate)) return candidate;
  const artist = track.artist.replace(/\s*-\s*Topic$/i, "").trim();
  if (!artist || /\b(uploader|festival|coachella|rolling loud|tomorrowland|npr|vevo|records|official|live aid|mtv|channel)\b/i.test(artist)) return null;
  return artist;
}
export function MusicPerformanceArtist({ track }: { track: MusicTrack }) {
  const t = useT(), { goToArtist } = useMusicNavigate();
  const name = performanceArtistName(track);
  const [artist, setArtist] = useState<MusicArtistRef | null>(null);
  useEffect(() => {
    let live = true; setArtist(null);
    if (name) void resolveArtist(name).then(value => { if (live) setArtist(value.canonical); }).catch(() => {});
    return () => { live = false; };
  }, [name]);
  if (!name) return null;
  return <button type="button" className="music-performance-artist" onClick={() => goToArtist(artist?.name ?? name)} aria-label={t("music.card.openItem", { title: artist?.name ?? name })}>
    <span aria-hidden="true">{name[0]}{artist?.artwork && <img src={artist.artwork} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }}/>}</span><strong>{artist?.name ?? name}</strong>
  </button>;
}
