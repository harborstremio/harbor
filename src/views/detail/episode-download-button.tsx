import { ArrowDownToLine, Check, Pause, Play, RotateCw } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor, pauseDownload, resumeDownload, useDownloads } from "@/lib/download/downloads-store";
import { useView, type PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function EpisodeDownloadButton({
  meta,
  episode,
  size = 40,
  variant = "row",
  intent = "download",
}: {
  meta: Meta;
  episode?: PlayEpisode;
  size?: number;
  variant?: "row" | "bar";
  intent?: "play" | "download" | "download-season";
}) {
  const t = useT();
  const { openPicker } = useView();
  useDownloads();
  const dl = activeDownloadFor(meta.id, episode?.season ?? null, episode?.episode ?? null);
  const status = dl?.status;
  const downloading = status === "downloading";
  const paused = status === "paused";
  const done = status === "done";
  const failed = status === "error";
  const persistent = downloading || paused || done || failed;
  const ratio = dl?.ratio ?? 0;
  const pct = Math.round(ratio * 100);
  const isBar = variant === "bar";
  const dim = isBar ? 48 : size;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading && dl) {
      pauseDownload(dl.id);
      return;
    }
    if (paused && dl) {
      void resumeDownload(dl.id);
      return;
    }
    openPicker(meta, episode, { intent });
  };

  const r = (dim - 7) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = dim >= 38 ? 2.5 : 2.2;

  const stateTone = done
    ? "text-emerald-300"
    : failed
      ? isBar
        ? "text-danger"
        : "text-danger hover:bg-danger/10"
      : isBar
        ? "text-ink"
        : "text-ink-subtle hover:bg-elevated hover:text-ink active:scale-90";
  const wrapperClass = isBar
    ? `group/dl relative flex shrink-0 items-center justify-center rounded-full border border-edge bg-canvas/80 transition-[transform,background-color,border-color] duration-200 hover:border-ink-subtle hover:bg-canvas/95 active:scale-[0.96] ${stateTone}`
    : `group/dl relative flex shrink-0 items-center justify-center self-start rounded-full transition-[opacity,background-color,transform] duration-200 ease-out ${
        persistent ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${stateTone}`;

  const showProgress = downloading || paused;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        downloading
          ? t("Downloading {pct} percent, click to pause", { pct })
          : paused
            ? t("Paused, click to resume")
            : done
              ? t("Saved offline")
              : failed
                ? t("Download failed, click to retry")
                : t("Download for offline")
      }
      title={
        downloading
          ? t("Downloading {pct}%  ·  click to pause", { pct })
          : paused
            ? t("Paused  ·  click to resume")
            : done
              ? t("Saved offline")
              : failed
                ? t("Download failed  ·  click to retry")
                : t("Download for offline")
      }
      className={wrapperClass}
      style={{ width: dim, height: dim }}
    >
      {showProgress ? (
        <>
          <svg
            width={dim}
            height={dim}
            viewBox={`0 0 ${dim} ${dim}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={r}
              fill="none"
              className="text-ink"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth={stroke}
            />
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={r}
              fill="none"
              className="text-accent transition-[stroke-dashoffset] duration-500 ease-out"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(1, Math.max(0.03, ratio)))}
            />
          </svg>
          <span className="absolute text-[9.5px] font-semibold tabular-nums text-ink-muted transition-opacity duration-150 group-hover/dl:opacity-0">
            {paused ? "II" : pct}
          </span>
          {downloading && (
            <Pause
              size={dim * 0.34}
              strokeWidth={2.2}
              className="absolute text-ink opacity-0 transition-opacity duration-150 group-hover/dl:opacity-100"
            />
          )}
          {paused && (
            <Play
              size={dim * 0.34}
              strokeWidth={2.2}
              className="absolute text-ink opacity-0 transition-opacity duration-150 group-hover/dl:opacity-100"
            />
          )}
        </>
      ) : done ? (
        <Check size={dim * 0.46} strokeWidth={2.6} />
      ) : failed ? (
        <RotateCw size={dim * 0.42} strokeWidth={2.2} />
      ) : (
        <ArrowDownToLine size={dim * 0.46} strokeWidth={2} />
      )}
    </button>
  );
}
