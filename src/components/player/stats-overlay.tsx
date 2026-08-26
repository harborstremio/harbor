import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type MpvPlaybackStats = {
  mpvVersion: string | null;
  videoBitrate: number | null;
  videoBitrateAverage: number | null;
  audioBitrate: number | null;
  audioBitrateAverage: number | null;
  decoderFrameDrops: number | null;
  outputFrameDrops: number | null;
  sourceFps: number | null;
  displayFps: number | null;
  containerFps: number | null;
  avSync: number | null;
  videoCodec: string | null;
  videoCodecProfile: string | null;
  audioCodec: string | null;
  audioCodecProfile: string | null;
  audioChannels: string | null;
  hwdec: string | null;
  cacheAheadSec: number | null;
  cacheSpeed: number | null;
  cacheBufferingPercent: number | null;
  cachedBytes: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoPixelFormat: string | null;
  videoMatrix: string | null;
  videoPrimaries: string | null;
  videoGamma: string | null;
  videoMaxLuma: number | null;
  videoMaxCll: number | null;
  videoMaxFall: number | null;
  targetWidth: number | null;
  targetHeight: number | null;
  targetPixelFormat: string | null;
  targetMatrix: string | null;
  targetPrimaries: string | null;
  targetGamma: string | null;
  targetMaxLuma: number | null;
  currentVo: string | null;
  gpuContext: string | null;
  windowWidth: number | null;
  windowHeight: number | null;
};

type StatsRow = readonly [label: string, value: string];

const EMPTY_STATS: MpvPlaybackStats = {
  mpvVersion: null,
  videoBitrate: null,
  videoBitrateAverage: null,
  audioBitrate: null,
  audioBitrateAverage: null,
  decoderFrameDrops: null,
  outputFrameDrops: null,
  sourceFps: null,
  displayFps: null,
  containerFps: null,
  avSync: null,
  videoCodec: null,
  videoCodecProfile: null,
  audioCodec: null,
  audioCodecProfile: null,
  audioChannels: null,
  hwdec: null,
  cacheAheadSec: null,
  cacheSpeed: null,
  cacheBufferingPercent: null,
  cachedBytes: null,
  videoWidth: null,
  videoHeight: null,
  videoPixelFormat: null,
  videoMatrix: null,
  videoPrimaries: null,
  videoGamma: null,
  videoMaxLuma: null,
  videoMaxCll: null,
  videoMaxFall: null,
  targetWidth: null,
  targetHeight: null,
  targetPixelFormat: null,
  targetMatrix: null,
  targetPrimaries: null,
  targetGamma: null,
  targetMaxLuma: null,
  currentVo: null,
  gpuContext: null,
  windowWidth: null,
  windowHeight: null,
};

function hasValue(value: string | number | null | undefined): value is string | number {
  return value !== null && value !== undefined && value !== "";
}

function joinValues(...values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length ? present.join(" · ") : null;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps.toFixed(0)} bps`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

function formatSize(width: number | null, height: number | null): string | null {
  return hasValue(width) && hasValue(height) && width > 0 && height > 0 ? `${width}×${height}` : null;
}

function addRow(rows: StatsRow[], label: string, value: string | number | null | undefined): void {
  if (hasValue(value)) rows.push([label, String(value)]);
}

export function StatsOverlay({
  snap,
  engine,
}: {
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
}) {
  const tr = useT();
  const [stats, setStats] = useState<MpvPlaybackStats>(EMPTY_STATS);

  useEffect(() => {
    if (engine !== "mpv" || !isTauri) {
      setStats(EMPTY_STATS);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await invoke<MpvPlaybackStats>("mpv_playback_stats");
        if (!cancelled) setStats({ ...EMPTY_STATS, ...next });
      } catch {
        if (!cancelled) setStats(EMPTY_STATS);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [engine]);

  const audioTrack = snap.audioTracks.find((track) => track.selected) ?? null;
  const subTrack = snap.subtitleTracks.find((track) => track.selected) ?? null;
  const sourceSize = formatSize(stats.videoWidth, stats.videoHeight)
    ?? formatSize(snap.videoWidth, snap.videoHeight);
  const targetSize = formatSize(stats.targetWidth, stats.targetHeight);
  const windowSize = formatSize(stats.windowWidth, stats.windowHeight);
  const sourceFps = stats.sourceFps ?? stats.containerFps;
  const sourceColour = joinValues(stats.videoMatrix, stats.videoPrimaries, stats.videoGamma);
  const targetColour = joinValues(stats.targetMatrix, stats.targetPrimaries, stats.targetGamma);
  const hdrDetails = [
    hasValue(stats.videoMaxLuma) ? `${stats.videoMaxLuma.toFixed(0)} nits` : null,
    hasValue(stats.videoMaxCll) ? `MaxCLL ${stats.videoMaxCll.toFixed(0)}` : null,
    hasValue(stats.videoMaxFall) ? `MaxFALL ${stats.videoMaxFall.toFixed(0)}` : null,
  ].filter((value): value is string => Boolean(value)).join(" · ");
  const currentBitrate = joinValues(
    hasValue(stats.videoBitrate) ? `V ${formatBitrate(stats.videoBitrate)}` : null,
    hasValue(stats.audioBitrate) ? `A ${formatBitrate(stats.audioBitrate)}` : null,
  );
  const averageBitrate = joinValues(
    hasValue(stats.videoBitrateAverage) ? `V ${formatBitrate(stats.videoBitrateAverage)}` : null,
    hasValue(stats.audioBitrateAverage) ? `A ${formatBitrate(stats.audioBitrateAverage)}` : null,
  );

  const playbackRows: StatsRow[] = [];
  addRow(playbackRows, tr("Engine"), joinValues(engine === "mpv" ? "libmpv" : "HTML5", stats.mpvVersion));
  addRow(playbackRows, tr("Resolution"), joinValues(sourceSize, stats.videoPixelFormat));
  addRow(
    playbackRows,
    tr("Frame rate"),
    hasValue(sourceFps)
      ? `${sourceFps.toFixed(3)} fps${hasValue(stats.displayFps) ? ` → ${stats.displayFps.toFixed(3)} Hz` : ""}`
      : null,
  );
  addRow(
    playbackRows,
    tr("Dropped frames"),
    hasValue(stats.decoderFrameDrops)
      ? `${stats.decoderFrameDrops} / ${stats.outputFrameDrops ?? 0}`
      : null,
  );
  addRow(playbackRows, tr("A/V sync"), hasValue(stats.avSync) ? `${stats.avSync.toFixed(3)} s` : null);
  addRow(playbackRows, tr("Speed"), `${snap.rate.toFixed(2)}×`);

  const videoRows: StatsRow[] = [];
  addRow(videoRows, tr("Video codec"), joinValues(stats.videoCodec, stats.videoCodecProfile));
  addRow(videoRows, tr("HW decode"), stats.hwdec);
  addRow(videoRows, tr("Current A/V bitrate"), currentBitrate);
  addRow(videoRows, tr("Average A/V bitrate"), averageBitrate);
  addRow(videoRows, tr("Source colour"), sourceColour);
  addRow(videoRows, tr("HDR metadata"), hdrDetails || null);
  addRow(
    videoRows,
    tr("Display target"),
    joinValues(targetColour, hasValue(stats.targetMaxLuma) ? `${stats.targetMaxLuma.toFixed(0)} nits` : null),
  );

  const audioRows: StatsRow[] = [];
  addRow(audioRows, tr("Audio codec"), joinValues(stats.audioCodec, stats.audioCodecProfile));
  addRow(audioRows, tr("Audio channels"), stats.audioChannels);
  addRow(audioRows, tr("Audio track"), audioTrack ? audioTrack.title || audioTrack.lang || audioTrack.id : null);
  addRow(audioRows, tr("Subtitle track"), subTrack ? subTrack.title || subTrack.lang || subTrack.id : tr("Off"));
  addRow(audioRows, tr("Volume"), `${Math.round(snap.volume * 100)}%${snap.muted ? tr(" · muted") : ""}`);

  const streamRows: StatsRow[] = [];
  addRow(
    streamRows,
    tr("Cache ahead"),
    hasValue(stats.cacheAheadSec)
      ? `${stats.cacheAheadSec.toFixed(1)} s${hasValue(stats.cacheBufferingPercent) ? ` · ${stats.cacheBufferingPercent.toFixed(0)}%` : ""}`
      : hasValue(snap.bufferedSec) && snap.bufferedSec > 0 ? `${snap.bufferedSec.toFixed(1)} s` : null,
  );
  addRow(streamRows, tr("Download speed"), hasValue(stats.cacheSpeed) ? `${formatBytes(stats.cacheSpeed)}/s` : null);
  addRow(streamRows, tr("Cached data"), hasValue(stats.cachedBytes) ? formatBytes(stats.cachedBytes) : null);
  addRow(streamRows, tr("Renderer"), joinValues(stats.currentVo, stats.gpuContext));
  addRow(streamRows, tr("Video output"), joinValues(targetSize, stats.targetPixelFormat));
  addRow(streamRows, tr("Viewport"), windowSize);

  const sections = [
    { title: tr("Playback"), rows: playbackRows },
    { title: tr("Video"), rows: videoRows },
    { title: tr("Audio & subtitles"), rows: audioRows },
    { title: tr("Streaming & renderer"), rows: streamRows },
  ].filter((section) => section.rows.length > 0);

  return (
    <div className="pointer-events-none absolute start-6 top-20 z-20 w-[min(680px,calc(100vw-3rem))] animate-fade-in rounded-2xl border border-edge-soft bg-canvas/85 p-4 font-mono text-[11.5px] leading-relaxed text-ink shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
        {tr("Playback stats · press I to hide")}
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {section.title}
            </h3>
            <dl className="flex flex-col gap-0.5">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-ink-muted">{label}</dt>
                  <dd className="min-w-0 truncate text-end" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
