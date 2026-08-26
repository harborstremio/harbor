import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { openLinkOut } from "@/lib/social/link-out";
import {
  fetchAudioMeta,
  parseProfileAudio,
  sendAudioCommand,
  sendAudioVolume,
  type AudioMeta,
} from "@/lib/social/profile-audio";

const VOLUME_KEY = "harbor.profileAudioVolume.v1";

function readSavedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw != null) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
    }
  } catch {}
  return 70;
}

function saveVolume(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {}
}

export function ProfileAudioCard({ audioUrl }: { audioUrl?: string }) {
  const t = useT();
  const { settings, update } = useSettings();
  const mode = settings.profileAudio ?? "auto";
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(readSavedVolume);
  const [barOpen, setBarOpen] = useState(false);
  const [mountMuted, setMountMuted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const audio = audioUrl ? parseProfileAudio(audioUrl, { autoplay: true, muted: mountMuted }) : null;

  useEffect(() => {
    setStarted(false);
    setPlaying(false);
    setMuted(false);
    setMeta(null);
    if (!audio) return;
    const ctrl = new AbortController();
    void fetchAudioMeta(audio, ctrl.signal).then((m) => {
      if (!ctrl.signal.aborted) setMeta(m);
    });
    return () => ctrl.abort();
  }, [audioUrl]);

  const startPlay = () => {
    setMountMuted(muted);
    setStarted(true);
    setPlaying(true);
  };

  useEffect(() => {
    if (audio && mode === "auto") {
      setMountMuted(muted);
      setStarted(true);
      setPlaying(true);
    }
  }, [audioUrl, mode]);

  // Real pause/resume against the mounted embed, so the song keeps its position
  // instead of the iframe being torn down and rebuilt from the start.
  useEffect(() => {
    if (!started) return;
    sendAudioCommand(frameRef.current, audio?.provider ?? "youtube", playing ? "play" : "pause");
  }, [playing, started]);

  useEffect(() => {
    if (!started) return;
    sendAudioCommand(frameRef.current, audio?.provider ?? "youtube", muted ? "mute" : "unmute");
  }, [muted, started]);

  useEffect(() => {
    if (!started || muted) return;
    sendAudioVolume(frameRef.current, audio?.provider ?? "youtube", volume);
  }, [volume, started, muted]);

  const onVolumeDrag = (next: number) => {
    setVolume(next);
    saveVolume(next);
    if (next > 0 && muted) setMuted(false);
  };

  if (!audio || mode === "off") return null;

  const title = meta?.title || t("Now playing");
  const isSpotify = audio.provider === "spotify";

  return (
    <section
      aria-label={t("Profile song")}
      className="relative rounded-[14px] bg-surface ring-1 ring-edge-soft"
    >
      {isSpotify ? (
        <iframe
          src={audio.embedSrc}
          title={title}
          loading="lazy"
          allow="encrypted-media; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block h-[152px] w-full rounded-[14px] border-0"
        />
      ) : (
        <>
          <div className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => (started ? setPlaying((p) => !p) : startPlay())}
              aria-label={playing ? t("Pause") : t("Play")}
              className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-elevated ring-1 ring-edge-soft"
            >
              {meta?.thumbnail ? (
                <img src={meta.thumbnail} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <Music2 size={18} className="text-ink-subtle" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-canvas/55 opacity-0 transition-opacity hover:opacity-100">
                {playing ? <Pause size={16} className="text-ink" /> : <Play size={16} className="text-ink" />}
              </span>
            </button>

            <button
              type="button"
              onClick={() => openLinkOut(audio.url)}
              className="min-w-0 flex-1 text-start"
            >
              <span className="block truncate text-[13px] font-semibold text-ink">{title}</span>
              <span className="block truncate text-[11.5px] text-ink-subtle">
                {meta?.author || (audio.provider === "youtube" ? "YouTube" : "SoundCloud")}
              </span>
            </button>

            <div
              className="relative shrink-0"
              onPointerEnter={() => setBarOpen(true)}
              onPointerLeave={() => setBarOpen(false)}
            >
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? t("Unmute") : t("Mute")}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <div
                className={`absolute bottom-full left-1/2 z-20 flex -translate-x-1/2 flex-col items-center rounded-[14px] border border-edge-soft bg-canvas/95 px-2.5 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md transition-[opacity,transform] duration-150 ${
                  barOpen ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
                }`}
              >
                <VolumeBar value={muted ? 0 : volume} onChange={onVolumeDrag} />
                <span className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-subtle">
                  {muted ? 0 : volume}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (mode === "auto") {
                setStarted(false);
                setPlaying(false);
                update({ profileAudio: "click" });
                return;
              }
              update({ profileAudio: "auto" });
              startPlay();
            }}
            className="w-full border-t border-edge-soft/60 px-3 py-1.5 text-[11px] text-ink-subtle transition-colors hover:text-ink"
          >
            {mode === "auto" ? t("Mute all profile songs") : t("Autoplay profile songs")}
          </button>

          {started && (
            <iframe
              ref={frameRef}
              src={audio.embedSrc}
              title={title}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                sendAudioCommand(frameRef.current, audio.provider, muted ? "mute" : "unmute");
                if (!muted) sendAudioVolume(frameRef.current, audio.provider, volume);
                if (!playing) sendAudioCommand(frameRef.current, audio.provider, "pause");
              }}
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
          )}
        </>
      )}
    </section>
  );
}

function VolumeBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);

  const pick = (clientY: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.height === 0) return;
    const f = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    onChange(Math.round(f * 100));
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e.clientY);
      }}
      onWheel={(e) => onChange(Math.max(0, Math.min(100, value + (e.deltaY < 0 ? 5 : -5))))}
      onPointerEnter={() => setWide(true)}
      onPointerLeave={() => setWide(false)}
      className="relative flex h-28 w-6 cursor-pointer touch-none items-stretch justify-center"
    >
      <div
        className="relative self-stretch rounded-full bg-ink/25 transition-[width] duration-150 ease-out"
        style={{ width: wide ? "10px" : "5px" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 rounded-full bg-ink"
          style={{ height: value + "%" }}
        />
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full bg-ink shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-[width,height] duration-150 ease-out"
          style={{ width: wide ? "15px" : "11px", height: wide ? "15px" : "11px", bottom: value + "%" }}
        />
      </div>
    </div>
  );
}
