import type { ReactNode } from "react";
import { BookOpen, Check, FileText, FolderOpen, Trash2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { DownloadCancelIcon, DownloadPauseResumeIcon } from "@/components/download-action-icons";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import {
  cancelDownload,
  pauseDownload,
  removeDownload,
  resumeDownload,
  revealDownload,
  type DownloadItem,
} from "@/lib/download/downloads-store";
import { fmtBytes, fmtEta, fmtSpeed } from "./downloads-format";

export function DownloadRow({ d, compact = false }: { d: DownloadItem; compact?: boolean }) {
  const t = useT();
  const { openPlayer } = useView();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    d.metaId,
    d.poster ?? undefined,
    d.season != null ? "series" : "movie",
  );
  const isEBook = d.kind === "ebook";
  const pct = Math.round(d.ratio * 100);
  const downloading = d.status === "downloading";
  const active = downloading || d.status === "paused";
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
        <Poster
          src={isEBook ? (d.poster ?? undefined) : poster.src}
          onError={isEBook ? undefined : poster.onError}
          seed={d.metaId}
          ratio="portrait"
        />
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
        {active ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-ink-muted">
              <span>{d.status === "paused" ? t("Paused") : `${pct}%`}</span>
              {d.phaseLabel && <span className="text-ink-subtle">· {t(d.phaseLabel)}</span>}
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
                  {d.phaseLabel ? t(d.phaseLabel) : t("Saved")}
                  {d.streamLabel ? ` · ${d.streamLabel}` : ""}
                  {d.totalBytes ? ` · ${fmtBytes(d.totalBytes)}` : ""}
                </span>
              </>
            )}
            {d.status === "error" && (
              <span className="text-danger">
                {t("Failed: {error}", { error: d.error ?? t("download error") })}
              </span>
            )}
            {d.status === "canceled" && <span className="text-ink-subtle">{t("Canceled")}</span>}
            {d.status === "interrupted" && (
              <span className="text-amber-300/85">{t("Interrupted: re-download to finish")}</span>
            )}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {active && (
          <>
            {d.canPause !== false && (
              <RowBtn
                label={d.status === "paused" ? t("Resume download") : t("Pause download")}
                onClick={() => {
                  if (d.status === "paused") void resumeDownload(d.id);
                  else pauseDownload(d.id);
                }}
              >
                <DownloadPauseResumeIcon paused={d.status === "paused"} size={16} />
              </RowBtn>
            )}
            <RowBtn label={t("Cancel download")} onClick={() => cancelDownload(d.id)} cancel>
              <DownloadCancelIcon size={16} />
            </RowBtn>
          </>
        )}
        {!active && (
          <>
            {d.status === "done" && (
              <>
                {!isEBook && (
                  <RowBtn label={t("Play")} onClick={playLocal}>
                    <Play size={16} strokeWidth={2.2} fill="currentColor" />
                  </RowBtn>
                )}
                {isEBook && d.format === "pdf" ? (
                  <span
                    className="flex h-9 w-9 items-center justify-center text-ink-subtle"
                    title={t("PDF print dialog opened")}
                  >
                    <FileText size={16} />
                  </span>
                ) : (
                  <RowBtn label={t("Show in folder")} onClick={() => void revealDownload(d.id)}>
                    {isEBook ? (
                      <BookOpen size={16} strokeWidth={2} />
                    ) : (
                      <FolderOpen size={16} strokeWidth={2} />
                    )}
                  </RowBtn>
                )}
              </>
            )}
            <DeleteButton onClick={() => removeDownload(d.id)} />
          </>
        )}
      </div>
    </li>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Delete download and file")}
      title={t("Delete download and file")}
      className="download-delete-trigger flex h-9 items-center justify-center gap-2.5 rounded-full border border-danger/10 bg-danger/5 px-4 text-[13px] font-medium tracking-tight text-danger transition-[transform,background-color] duration-150 ease-out hover:scale-[1.02] hover:bg-danger/10 active:scale-[0.96] motion-reduce:transition-none"
    >
      <Trash2 size={16} strokeWidth={2} className="download-delete-icon shrink-0" />
      <span>{t("Delete")}</span>
    </button>
  );
}

function RowBtn({
  label,
  onClick,
  cancel = false,
  children,
}: {
  label: string;
  onClick: () => void;
  cancel?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none ${
        cancel
          ? "download-cancel-trigger text-ink-subtle hover:bg-danger/10 hover:text-danger"
          : "text-ink-subtle hover:bg-ink/10 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
