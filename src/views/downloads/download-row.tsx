import type { ReactNode } from "react";
import { Check, FolderOpen, Play, Trash2, X } from "lucide-react";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import {
  cancelDownload,
  removeDownload,
  revealDownload,
  type DownloadItem,
} from "@/lib/download/downloads-store";
import { fmtBytes, fmtEta, fmtSpeed } from "./downloads-format";

export function DownloadRow({ d, compact = false }: { d: DownloadItem; compact?: boolean }) {
  const { openPlayer } = useView();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    d.metaId,
    d.poster ?? undefined,
    d.season != null ? "series" : "movie",
  );
  const pct = Math.round(d.ratio * 100);
  const downloading = d.status === "downloading";
  const playLocal = () =>
    openPlayer({
      meta: {
        id: d.metaId,
        type: d.season != null ? "series" : "movie",
        name: d.title,
        poster: d.poster ?? undefined,
      },
      url: d.path,
      title: d.title,
      subtitle: d.subtitle ?? undefined,
      notWebReady: true,
      episode:
        d.season != null && d.episode != null
          ? { season: d.season, episode: d.episode }
          : undefined,
    });
  return (
    <li className="group flex items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-3 transition-colors hover:bg-elevated/70">
      <div
        className={`${compact ? "h-[44px] w-[30px]" : "h-[68px] w-[46px]"} shrink-0 overflow-hidden rounded-lg`}
      >
        <Poster src={poster.src} onError={poster.onError} seed={d.metaId} ratio="portrait" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-ink">
            {compact ? (d.subtitle ?? d.title) : d.title}
          </span>
          {!compact && d.subtitle && (
            <span className="shrink-0 truncate text-[12px] text-ink-subtle">{d.subtitle}</span>
          )}
        </div>
        {downloading ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-ink-muted">
              <span>{pct}%</span>
              {d.totalBytes != null && (
                <span className="text-ink-subtle">
                  {fmtBytes(d.receivedBytes)} / {fmtBytes(d.totalBytes)}
                </span>
              )}
              {fmtSpeed(d.bytesPerSec) && <span>· {fmtSpeed(d.bytesPerSec)}</span>}
              {fmtEta(d) && <span className="text-ink-subtle">· {fmtEta(d)}</span>}
            </div>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px]">
            {d.status === "done" && (
              <>
                <Check size={13} className="text-accent" strokeWidth={2.6} />
                <span className="text-ink-muted">
                  Saved{d.streamLabel ? ` · ${d.streamLabel}` : ""}
                  {d.totalBytes ? ` · ${fmtBytes(d.totalBytes)}` : ""}
                </span>
              </>
            )}
            {d.status === "error" && (
              <span className="text-danger">Failed: {d.error ?? "download error"}</span>
            )}
            {d.status === "canceled" && <span className="text-ink-subtle">Canceled</span>}
            {d.status === "interrupted" && (
              <span className="text-amber-300/85">Interrupted: re-download to finish</span>
            )}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {downloading ? (
          <RowBtn label="Cancel download" onClick={() => cancelDownload(d.id)}>
            <X size={16} strokeWidth={2.2} />
          </RowBtn>
        ) : (
          <>
            {d.status === "done" && (
              <>
                <RowBtn label="Play" onClick={playLocal}>
                  <Play size={16} strokeWidth={2.2} fill="currentColor" />
                </RowBtn>
                <RowBtn label="Show in folder" onClick={() => void revealDownload(d.id)}>
                  <FolderOpen size={16} strokeWidth={2} />
                </RowBtn>
              </>
            )}
            <RowBtn label="Delete download and file" onClick={() => removeDownload(d.id)}>
              <Trash2 size={16} strokeWidth={2} />
            </RowBtn>
          </>
        )}
      </div>
    </li>
  );
}

function RowBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition duration-150 hover:bg-ink/10 hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}
