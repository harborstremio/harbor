import { useEffect, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { ArrowLeft, ArrowRight, Play, RotateCcw } from "@/components/icons/music-icons";
import { Poster } from "@/components/poster";
import { MusicPerformanceArtist } from "@/components/music/music-performance-artist";
import { useT } from "@/lib/i18n";
import { MUSIC_EVENTS, eventYears, loadEventSets, loadRecentEventSets, type EventSet } from "@/lib/music/events";
import type { MusicTrack } from "@/lib/music/types";
import "./music-event-discovery.css";

export function MusicEventDiscovery({ active, onWatch }: { active: boolean; onWatch: (track: MusicTrack, queue: MusicTrack[]) => void }) {
  const t = useT();
  const [eventId, setEventId] = useState("recent"), [year, setYear] = useState("");
  const [index, setIndex] = useState(0), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; sets: EventSet[]; error: boolean } | null>(null);
  const event = MUSIC_EVENTS.find(item => item.id === eventId), key = `${eventId}:${year}`;
  useEffect(() => {
    if (!active) return;
    let live = true; setResult(null); setIndex(0);
    const request = event ? loadEventSets(event, year ? Number(year) : undefined, retry > 0) : loadRecentEventSets(retry > 0);
    request.then(sets => { if (live) setResult({ key, sets, error: false }); })
      .catch(() => { if (live) setResult({ key, sets: [], error: true }); });
    return () => { live = false; };
  }, [event, year, key, active, retry]);
  const current = result?.key === key ? result : null, featured = current?.sets[index];
  const watch = (item: EventSet) => onWatch(item.track, current!.sets.map(set => set.track));
  return <section className="music-events" aria-label={t("music.explore.events")}>
    <header className="music-events-heading"><div><h2>{t("music.explore.events")}</h2><p>{t("music.explore.eventHint")}</p></div>
      <div className="music-events-filters">
        <Dropdown ariaLabel={t("music.explore.event")} value={eventId} options={[{ value: "recent", label: t("music.explore.recentSets") }, ...MUSIC_EVENTS.map(item => ({ value: item.id, label: item.name }))]}
          onChange={value => { setEventId(value); setYear(""); setRetry(0); }}/>
        {event && <Dropdown ariaLabel={t("music.explore.year")} value={year} options={[{ value: "", label: t("music.explore.anyYear") }, ...eventYears(event).map(value => ({ value: String(value), label: String(value) }))]}
          onChange={value => { setYear(value); setRetry(0); }}/>}</div>
    </header>
    {!current ? <div className="music-events-loading" role="status" aria-label={t("music.videos.loading")}><span/><div><span/><span/><span/></div></div>
      : !featured ? <div className="music-events-message" role="status"><p>{t(current.error ? "music.videos.error" : "music.videos.empty")}</p><button type="button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={18}/>{t("common.retry")}</button></div>
      : <>
        <div className="music-events-stage">
          <div className="music-events-feature"><button className="music-events-hero" type="button" onClick={() => watch(featured)} aria-label={t("music.videos.watch", { title: featured.track.title })}>
            <Poster src={featured.track.artwork} seed={featured.track.id} ratio="wide" className="music-events-image"/>
            <span className="music-events-caption"><small>{featured.event.name}{featured.year ? ` · ${featured.year}` : ""}</small><strong>{featured.track.title}</strong><span><span className="music-events-play"><Play size={22} fill="currentColor"/></span>{t("music.explore.watchPerformance")}<time>{featured.track.durationLabel}</time></span></span>
          </button><MusicPerformanceArtist track={featured.track}/></div>
          <div className="music-events-side">{current.sets.filter((_,i) => i !== index).slice(0,3).map(item => <div className="music-events-side-item" key={item.track.id}><button type="button" onClick={() => watch(item)} aria-label={t("music.videos.watch", { title: item.track.title })}>
            <span className="music-events-thumb"><Poster src={item.track.artwork} seed={item.track.id} ratio="wide"/><span><Play size={20} fill="currentColor"/></span></span>
            <span className="music-events-side-copy"><small>{item.event.name}{item.year ? ` · ${item.year}` : ""}</small><strong>{item.track.title}</strong><time>{item.track.durationLabel}</time></span>
          </button><MusicPerformanceArtist track={item.track}/></div>)}</div>
        </div>
        <footer><span>{t(event ? "music.explore.moreSets" : "music.explore.recentSets")} · YouTube</span><div><button type="button" disabled={index === 0} aria-label={t("common.previous")} onClick={() => setIndex(value => value - 1)}><ArrowLeft className="dir-icon" size={18}/></button><span>{index + 1} / {current.sets.length}</span><button type="button" disabled={index >= current.sets.length - 1} aria-label={t("common.next")} onClick={() => setIndex(value => value + 1)}><ArrowRight className="dir-icon" size={18}/></button></div></footer>
      </>}
  </section>;
}
