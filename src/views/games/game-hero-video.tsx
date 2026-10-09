import { useEffect, useRef, useState } from "react";
import { loadGameMicrotrailer } from "@/lib/games/catalog";

export function GameHeroVideo({ appId, playing, startDelayMs = 0, onPlaybackChange }: { appId: number; playing: boolean; startDelayMs?: number; onPlaybackChange?: (playing: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(startDelayMs === 0);
  useEffect(() => {
    setStarted(false);
    if (!playing) return;
    const timer = setTimeout(() => setStarted(true), startDelayMs);
    return () => clearTimeout(timer);
  }, [appId, playing, startDelayMs]);
  useEffect(() => {
    if (!playing || url || failed) return;
    let current = true;
    void loadGameMicrotrailer(appId).then(value => { if (current) { setUrl(value); if (!value) setFailed(true); } }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [appId, playing, url, failed]);
  useEffect(() => {
    const el = video.current; if (!el || !url) return;
    if (playing && started) { el.muted = true; void el.play().catch(() => setLoaded(false)); }
    else el.pause();
    return () => el.pause();
  }, [playing, started, url]);
  if (!url || failed) return null;
  return <video ref={video} className={`games-showcase-video${loaded && playing && started ? " is-playing" : ""}`} src={url} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} onPlaying={() => { setLoaded(true); onPlaybackChange?.(true); }} onPause={() => onPlaybackChange?.(false)} onError={() => { setFailed(true); onPlaybackChange?.(false); }} />;
}
