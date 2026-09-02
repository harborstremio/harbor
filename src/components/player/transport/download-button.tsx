import { CircleCheck, Download, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DownloadStatus } from "@/views/player/hooks/use-video-download";
import { useT } from "@/lib/i18n";
import { BigButton } from "./big-button";
import { Tooltip } from "./tooltip";

type Props = {
  status: DownloadStatus;
  onStart: () => void;
  onCancel: () => void;
  onReveal: () => void;
  onReset: () => void;
  iconUrl?: string;
};

export function DownloadButton({
  status,
  onStart,
  onCancel,
  onReveal,
  onReset,
  iconUrl,
}: Props) {
  const t = useT();
  useEffect(() => {
    if (status.kind !== "done") return;
    const timer = setTimeout(onReset, 12000);
    return () => clearTimeout(timer);
  }, [status.kind, onReset]);

  const speed = useDownloadSpeed(status);

  if (status.kind === "preparing") {
    return (
      <BigButton ariaLabel={t("Preparing download")} tooltip={t("Preparing")}>
        <span className="relative flex items-center justify-center">
          <Download size={22} strokeWidth={1.9} className="text-white/40" />
          <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
        </span>
      </BigButton>
    );
  }

  if (status.kind === "downloading") {
    const pct = Math.round(status.ratio * 100);
    const determinate = !!status.totalBytes;
    const detail = formatTooltip(status, speed, t);
    return (
      <Tooltip label={detail}>
        <button
          onClick={onCancel}
          aria-label={t("Downloading {pct}%, click to cancel", { pct })}
          className="group relative flex h-12 w-12 flex-col items-center justify-center rounded-full text-white/90 transition-[background-color,color] hover:bg-white/10 hover:text-white"
        >
          <ProgressRing ratio={status.ratio} indeterminate={!determinate} />
          {determinate ? (
            <>
              <Download size={10} strokeWidth={2.2} className="relative -mb-px opacity-70 transition-opacity group-hover:opacity-0" />
              <span className="relative text-[11px] font-bold leading-none tabular-nums transition-opacity group-hover:opacity-0">
                {pct}%
              </span>
            </>
          ) : (
            <Download size={20} strokeWidth={1.9} className="relative transition-opacity group-hover:opacity-0" />
          )}
          <X size={18} strokeWidth={2.4} className="absolute opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </Tooltip>
    );
  }

  if (status.kind === "done") {
    const folder = folderOf(status.path);
    return (
      <BigButton
        onClick={onReveal}
        ariaLabel={t("Show downloaded file")}
        tooltip={t("Saved to {folder} · open folder", { folder })}
      >
        <CircleCheck size={22} strokeWidth={1.9} className="text-emerald-300" />
      </BigButton>
    );
  }

  if (status.kind === "error") {
    return (
      <BigButton
        onClick={onReset}
        ariaLabel={t("Download failed")}
        tooltip={t("Failed: {message}", { message: status.message })}
      >
        <TriangleAlert size={22} strokeWidth={1.9} className="text-red-300" />
      </BigButton>
    );
  }

  return (
    <BigButton onClick={onStart} ariaLabel={t("Download video")} tooltip={t("Download")} iconUrl={iconUrl}>
      <Download size={22} strokeWidth={1.9} />
    </BigButton>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-[3px] w-[3px] animate-pulse rounded-full bg-white/70"
      style={{ animationDelay: `${delay}ms`, animationDuration: "1100ms" }}
    />
  );
}

function ProgressRing({
  ratio,
  indeterminate,
}: {
  ratio: number;
  indeterminate: boolean;
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, ratio)));
  return (
    <svg className="absolute inset-0" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r={r} stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
      <circle
        cx="24"
        cy="24"
        r={r}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={indeterminate ? c * 0.9 : offset}
        transform="rotate(-90 24 24)"
        className={`transition-[stroke-dashoffset] duration-500 ease-out ${indeterminate ? "animate-pulse" : ""}`}
      />
    </svg>
  );
}

function useDownloadSpeed(status: DownloadStatus): {
  bytesPerSec: number;
  etaSec: number | null;
} {
  const [speed, setSpeed] = useState({ bytesPerSec: 0, etaSec: null as number | null });
  const ref = useRef({ bytes: 0, at: Date.now() });

  useEffect(() => {
    if (status.kind !== "downloading") {
      ref.current = { bytes: 0, at: Date.now() };
      setSpeed({ bytesPerSec: 0, etaSec: null });
      return;
    }
    const now = Date.now();
    const dB = status.receivedBytes - ref.current.bytes;
    const dT = (now - ref.current.at) / 1000;
    if (dT < 0.5) return;
    const bps = dB / dT;
    const remaining = status.totalBytes ? status.totalBytes - status.receivedBytes : 0;
    const eta = bps > 0 && remaining > 0 ? Math.round(remaining / bps) : null;
    setSpeed({ bytesPerSec: bps, etaSec: eta });
    ref.current = { bytes: status.receivedBytes, at: now };
  }, [status]);

  return speed;
}

function formatTooltip(
  status: Extract<DownloadStatus, { kind: "downloading" }>,
  { bytesPerSec, etaSec }: { bytesPerSec: number; etaSec: number | null },
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const parts: string[] = [];
  if (status.totalBytes) {
    parts.push(`${Math.round(status.ratio * 100)}%`);
  } else {
    parts.push(formatBytes(status.receivedBytes));
  }
  if (bytesPerSec > 0) parts.push(`${formatBytes(bytesPerSec)}/s`);
  if (etaSec != null) parts.push(formatEta(etaSec, t));
  parts.push(t("click to cancel"));
  return parts.join(" · ");
}

function formatBytes(b: number): string {
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatEta(
  s: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (s < 60) return t("{s}s left", { s });
  if (s < 3600) return t("{m}m left", { m: Math.round(s / 60) });
  const h = Math.floor(s / 3600);
  const m = Math.round((s - h * 3600) / 60);
  return m > 0 ? t("{h}h {m}m left", { h, m }) : t("{h}h left", { h });
}

function folderOf(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  const idx = path.lastIndexOf(sep);
  if (idx <= 0) return path;
  const dir = path.slice(0, idx);
  const last = dir.split(sep).filter(Boolean).pop();
  return last ?? dir;
}
