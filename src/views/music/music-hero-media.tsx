import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useT } from "@/lib/i18n";
import { getMusicState, toggleMusicPlayback } from "@/lib/music/player";
import { musicVideoStream } from "@/lib/music/video";
import { searchMusicVideos } from "@/lib/music/video-discovery";
import { useHeroLayers } from "./use-hero-layers";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";

const PREVIEW_VOLUME = 0.38;
const TEACH_MS = 2600;

let taught = false;

type Preview = { key: string; url: string; audioUrl: string | null };

async function previewFor(track: MusicTrack): Promise<{ url: string; audioUrl: string | null } | null> {
  const direct = await musicVideoStream(track).catch(() => null);
  if (direct?.url) return { url: direct.url, audioUrl: direct.audioUrl };
  const query = [track.artist, track.title].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const found = await searchMusicVideos(query, false, false, undefined, track.artist).catch(
    () => [],
  );
  const top = found[0];
  if (!top) return null;
  const stream = await musicVideoStream(top).catch(() => null);
  return stream?.url ? { url: stream.url, audioUrl: stream.audioUrl } : null;
}

export function MusicHeroMedia({
  item,
  hovering,
  onMenu,
}: {
  item?: MusicCatalogItem;
  hovering: boolean;
  onMenu?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const t = useT();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [muted, setMuted] = useState(true);
  const [overArt, setOverArt] = useState(false);
  const [teaching, setTeaching] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const ducked = useRef(false);
  const key = item?.id ?? "";
  const artwork = item?.artwork;
  const layers = useHeroLayers(Array.isArray(artwork) ? artwork[0] : artwork);
  useEffect(() => {
    setPreview(null);
    setReadyUrl(null);
    setMuted(true);
  }, [key]);
  useEffect(() => {
    if (
      !hovering ||
      item?.kind !== "track" ||
      preview?.key === key ||
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSeeking(true);
      previewFor(item)
        .then((found) => {
          if (!cancelled && found) setPreview({ key, ...found });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSeeking(false);
        });
    }, 700);
    const hide = () => {
      if (document.hidden) {
        cancelled = true;
        setPreview(null);
        setReadyUrl(null);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSeeking(false);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [hovering, key, item?.kind, preview?.key]);
  const live = preview?.key === key ? preview : null;
  const playing = !!live && readyUrl === live.url;
  useEffect(() => {
    if (!(hovering && playing)) setSettled(false);
  }, [hovering, playing]);
  useEffect(() => {
    const node = art.current;
    if (!node) return;
    const watch = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35, 1] },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    const el = video.current;
    if (!el || !live) return;
    const track = audio.current;
    if (hovering && onScreen) {
      void el.play().catch(() => {});
      if (track) {
        track.currentTime = el.currentTime;
        void track.play().catch(() => {});
      }
      return;
    }
    el.pause();
    track?.pause();
  }, [hovering, live, onScreen, playing]);
  useEffect(() => {
    const el = video.current;
    const track = audio.current;
    if (track) {
      if (el) el.muted = true;
      track.volume = PREVIEW_VOLUME;
      track.muted = muted;
      return;
    }
    if (!el) return;
    el.volume = PREVIEW_VOLUME;
    el.muted = muted;
  }, [muted, playing]);
  const audible = playing && hovering && onScreen && !muted;
  useEffect(() => {
    if (audible && !ducked.current && getMusicState().phase === "playing") {
      ducked.current = true;
      toggleMusicPlayback();
      return;
    }
    if (!audible && ducked.current) {
      ducked.current = false;
      if (getMusicState().phase === "paused") toggleMusicPlayback();
    }
  }, [audible]);
  useEffect(
    () => () => {
      if (!ducked.current) return;
      ducked.current = false;
      if (getMusicState().phase === "paused") toggleMusicPlayback();
    },
    [],
  );
  useEffect(() => {
    if (!(playing && hovering) || taught) return;
    taught = true;
    setTeaching(true);
    const timer = setTimeout(() => setTeaching(false), TEACH_MS);
    return () => clearTimeout(timer);
  }, [playing, hovering]);
  const loading = hovering && seeking && !playing;
  const state = loading ? "loading" : muted ? "muted" : "live";
  const shown = loading || (playing && hovering && (overArt || teaching));
  return (
    <>
      <div
        ref={art}
        className="music-hero-media"
        aria-hidden="true"
        onContextMenu={onMenu}
        onPointerEnter={() => setOverArt(true)}
        onPointerLeave={() => setOverArt(false)}
      >
        {layers.map((layer) => (
          <img key={layer.id} src={layer.src} alt="" />
        ))}
      </div>
      <div
        className="music-hero-video"
        aria-hidden="true"
        onContextMenu={onMenu}
        data-on={(hovering && playing) || undefined}
        data-settled={(hovering && playing && settled) || undefined}
        onTransitionEnd={(event) => {
          if (event.propertyName === "clip-path") setSettled(hovering && playing);
        }}
      >
        {live && (
          <video
            ref={video}
            key={live.url}
            src={live.url}
            muted
            autoPlay
            playsInline
            loop
            onPlaying={() => setReadyUrl(live.url)}
            onError={() => {
              setPreview(null);
              setReadyUrl(null);
            }}
          />
        )}
        {live?.audioUrl && (
          <audio
            ref={audio}
            key={live.audioUrl}
            src={live.audioUrl}
            muted
            loop
            preload="auto"
          />
        )}
      </div>
      <button
        type="button"
        className="music-hero-sound"
        data-state={state}
        data-show={shown || undefined}
        disabled={loading}
        tabIndex={shown && !loading ? 0 : -1}
        aria-hidden={!shown || loading}
        aria-label={t(muted ? "music.unmute" : "music.mute")}
        aria-pressed={!muted}
        onPointerEnter={() => setOverArt(true)}
        onPointerLeave={() => setOverArt(false)}
        onClick={() => setMuted((value) => !value)}
      >
        <span className="music-hero-sound-glyph" data-on={state === "loading" || undefined}>
          <MusicGlyph name="loading" size={17} className="animate-spin motion-reduce:animate-none" />
        </span>
        <span className="music-hero-sound-glyph" data-on={state === "muted" || undefined}>
          <MusicGlyph name="volume-mute" size={17} />
        </span>
        <span className="music-hero-sound-glyph" data-on={state === "live" || undefined}>
          <MusicGlyph name="volume-high" size={17} />
        </span>
      </button>
    </>
  );
}
