import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { floatingChapters, floatingTracks, type FloatingChapter, type FloatingTrack } from "@/lib/player/floating-controls";

export function useFloatingMedia() {
  const [volume, setVolume] = useState(100), [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1), [subDelay, setSubDelay] = useState(0);
  const [tracks, setTracks] = useState<FloatingTrack[]>([]), [chapters, setChapters] = useState<FloatingChapter[]>([]);
  const [error, setError] = useState(false);
  const take = useCallback((name: string, value: unknown) => {
    if (name === "volume" && typeof value === "number") setVolume(value);
    if (name === "mute" && typeof value === "boolean") setMuted(value);
    if (name === "speed" && typeof value === "number") setSpeed(value);
    if (name === "sub-delay" && typeof value === "number") setSubDelay(value);
    if (name === "track-list") setTracks(floatingTracks(value));
    if (name === "chapter-list") setChapters(floatingChapters(value));
  }, []);
  useEffect(() => {
    let disposed = false;
    const off: Array<() => void> = [];
    const refresh = () => { for (const name of ["volume", "mute", "speed", "sub-delay", "track-list", "chapter-list"]) void invoke("mpv_get_property", { name }).then(value => { if (!disposed) take(name, value); }).catch(() => {}); };
    void (async () => {
      const events = await listen<{ event: string; name?: string; data?: unknown }>("mpv://event", e => {
        if (e.payload.event === "property-change" && e.payload.name) take(e.payload.name, e.payload.data);
        else if (e.payload.event === "file-loaded") refresh();
      });
      if (disposed) events(); else off.push(events);
      const entered = await listen("pip://detached-entered", refresh);
      if (disposed) entered(); else { off.push(entered); refresh(); }
    })().catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; off.forEach(fn => fn()); };
  }, [take]);
  const property = useCallback(async (name: string, value: unknown) => {
    try {
      await invoke("mpv_set_property", { name, value });
      take(name, value); setError(false);
      if (name === "aid" || name === "sid") {
        const list = await invoke("mpv_get_property", { name: "track-list" });
        take("track-list", list);
      }
    } catch { setError(true); }
  }, [take]);
  return { volume, muted, speed, subDelay, tracks, chapters, error, property, setError };
}

export function VideoPipSettings({ media, close, seek }: { media: ReturnType<typeof useFloatingMedia>; close: () => void; seek: (time: number) => void }) {
  const t = useT();
  return <div className="vpip-settings" role="dialog" aria-label={t("floatingPlayer.playbackSettings")} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
    <header><strong>{t("floatingPlayer.playbackSettings")}</strong><button onClick={close} aria-label={t("common.close")}><X size={16}/></button></header>
    {(["audio", "sub"] as const).map(type => <label key={type}>{t(type === "audio" ? "Audio" : "Subtitles")}<select aria-label={t(type === "audio" ? "Audio" : "Subtitles")} value={String(media.tracks.find(track => track.type === type && track.selected)?.id ?? "no")} onChange={e => { void media.property(type === "audio" ? "aid" : "sid", e.target.value === "no" ? "no" : Number(e.target.value)); }}>
      <option value="no">{t("Off")}</option>{media.tracks.filter(track => track.type === type).map(track => <option key={track.id} value={track.id}>{track.title || track.lang || `${t(type === "audio" ? "Audio" : "Subtitles")} ${track.id}`}</option>)}
    </select></label>)}
    <label>{t("floatingPlayer.playbackSpeed")}<select aria-label={t("floatingPlayer.playbackSpeed")} value={media.speed} onChange={e => { void media.property("speed", Number(e.target.value)); }}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    <label>{t("floatingPlayer.subtitleDelay")}<input aria-label={t("floatingPlayer.subtitleDelay")} type="number" step={0.1} min={-120} max={120} value={media.subDelay} onChange={e => { void media.property("sub-delay", Math.max(-120, Math.min(120, Number(e.target.value)))); }}/></label>
    {media.chapters.length > 0 && <label>{t("floatingPlayer.chapters")}<select aria-label={t("floatingPlayer.chapters")} value="" onChange={e => { seek(Number(e.target.value)); close(); }}><option value="" disabled>{t("floatingPlayer.chooseChapter")}</option>{media.chapters.map((chapter, index) => <option key={index} value={chapter.time}>{chapter.title || `${index + 1}`}</option>)}</select></label>}
  </div>;
}
