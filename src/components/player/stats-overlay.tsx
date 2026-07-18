import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type MpvStats = {
  videoBitrate: number | null;
  audioBitrate: number | null;
  frameDropDecoder: number | null;
  frameDropOutput: number | null;
  estimatedFps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hwdec: string | null;
  containerFps: number | null;
  cacheBufferingState: number | null;
};

const EMPTY_STATS: MpvStats = {
  videoBitrate: null,
  audioBitrate: null,
  frameDropDecoder: null,
  frameDropOutput: null,
  estimatedFps: null,
  videoCodec: null,
  audioCodec: null,
  hwdec: null,
  containerFps: null,
  cacheBufferingState: null,
};

async function getProp<T = unknown>(name: string): Promise<T | null> {
  if (!isTauri) return null;
  try {
    const v = await invoke<T>("mpv_get_property", { name });
    return v ?? null;
  } catch {
    return null;
  }
}

export function StatsOverlay({ snap, engine }: { snap: PlayerSnapshot; engine: "html5" | "mpv" }) {
  const tr = useT();
  const [stats, setStats] = useState<MpvStats>(EMPTY_STATS);

  useEffect(() => {
    if (engine !== "mpv") return;
    let cancelled = false;
    const tick = async () => {
      const [vb, ab, fdd, fdo, fps, vc, ac, hw, cfps, cb] = await Promise.all([
        getProp<number>("video-bitrate"),
        getProp<number>("audio-bitrate"),
        getProp<number>("frame-drop-count"),
        getProp<number>("vo-drop-frame-count"),
        getProp<number>("estimated-vf-fps"),
        getProp<string>("video-codec"),
        getProp<string>("audio-codec"),
        getProp<string>("hwdec-current"),
        getProp<number>("container-fps"),
        getProp<number>("cache-buffering-state"),
      ]);
      if (cancelled) return;
      setStats({
        videoBitrate: vb,
        audioBitrate: ab,
        frameDropDecoder: fdd,
        frameDropOutput: fdo,
        estimatedFps: fps,
        videoCodec: vc,
        audioCodec: ac,
        hwdec: hw,
        containerFps: cfps,
        cacheBufferingState: cb,
      });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [engine]);

  const audioTrack = snap.audioTracks.find((t) => t.selected) ?? null;
  const subTrack = snap.subtitleTracks.find((t) => t.selected) ?? null;
  const fps = stats.estimatedFps ?? stats.containerFps;

  const rows: Array<[string, string]> = [];
  rows.push([tr("Engine"), engine === "mpv" ? "libmpv" : "HTML5"]);
  rows.push([
    tr("Resolution"),
    snap.videoWidth && snap.videoHeight ? `${snap.videoWidth}×${snap.videoHeight}` : "—",
  ]);
  if (fps != null) rows.push([tr("Frame rate"), `${fps.toFixed(2)} fps`]);
  if (stats.videoCodec) rows.push([tr("Video codec"), stats.videoCodec]);
  if (stats.audioCodec) rows.push([tr("Audio codec"), stats.audioCodec]);
  if (stats.hwdec) rows.push([tr("HW decode"), stats.hwdec]);
  if (stats.videoBitrate != null)
    rows.push([tr("Video bitrate"), formatBitrate(stats.videoBitrate)]);
  if (stats.audioBitrate != null)
    rows.push([tr("Audio bitrate"), formatBitrate(stats.audioBitrate)]);
  if (stats.frameDropDecoder != null)
    rows.push([
      tr("Dropped (decode / vo)"),
      `${stats.frameDropDecoder} / ${stats.frameDropOutput ?? 0}`,
    ]);
  if (stats.cacheBufferingState != null)
    rows.push([tr("Cache buffering"), `${stats.cacheBufferingState.toFixed(0)}%`]);
  rows.push([
    tr("Audio track"),
    audioTrack ? audioTrack.title || audioTrack.lang || audioTrack.id : "—",
  ]);
  rows.push([
    tr("Subtitle track"),
    subTrack ? subTrack.title || subTrack.lang || subTrack.id : tr("Off"),
  ]);
  rows.push([tr("Speed"), `${snap.rate.toFixed(2)}×`]);
  rows.push([tr("Volume"), `${Math.round(snap.volume * 100)}%${snap.muted ? tr(" · muted") : ""}`]);

  return (
    <div className="pointer-events-none absolute start-6 top-20 z-20 max-w-[320px] animate-fade-in rounded-2xl border border-edge-soft bg-canvas/85 p-4 font-mono text-[11.5px] leading-relaxed text-ink shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
        {tr("Playback stats · press I to hide")}
      </p>
      <dl className="flex flex-col gap-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="truncate text-end">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps.toFixed(0)} bps`;
}
