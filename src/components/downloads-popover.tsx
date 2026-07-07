import { Download, FolderOpen, Pause, Play, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import {
  cancelDownload,
  pauseDownload,
  removeDownload,
  resumeDownload,
  revealDownload,
  useDownloads,
  type DownloadItem,
} from "@/lib/download/downloads-store";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

type T = (key: string) => string;

export function DownloadsButton() {
  const downloads = useDownloads();
  const t = useT();
  const { openMeta, setView } = useView();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeCount = downloads.filter((d) => d.status === "downloading").length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (downloads.length === 0) return null;

  const goToShow = (d: DownloadItem) => {
    setOpen(false);
    openMeta({
      id: d.metaId,
      type: d.season != null ? "series" : "movie",
      name: d.title,
      poster: d.poster ?? undefined,
    } as Meta);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        aria-label={t("Downloads")}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted transition-colors duration-150 hover:bg-elevated hover:text-ink"
      >
        <Download size={17} strokeWidth={1.9} />
        {activeCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-canvas">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-50 w-[20rem] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[13.5px] font-semibold text-ink">{t("Downloads")}</span>
            <button
              onClick={() => {
                setOpen(false);
                setView("downloads");
              }}
              className="text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("See all")}
            </button>
          </div>
          <div className="flex max-h-[min(60vh,420px)] flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {downloads.slice(0, 8).map((d) => (
              <DownloadRow key={d.id} d={d} t={t} onOpen={() => goToShow(d)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadRow({ d, t, onOpen }: { d: DownloadItem; t: T; onOpen: () => void }) {
  const pct = d.totalBytes
    ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100))
    : Math.round(d.ratio * 100);
  const active = d.status === "downloading" || d.status === "paused";
  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-raised/50">
      <button
        onClick={onOpen}
        title={t("Go to show")}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-canvas">
          {d.poster && <img src={d.poster} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13px] font-medium text-ink">{d.title}</span>
          {d.subtitle && <span className="truncate text-[11px] text-ink-subtle">{d.subtitle}</span>}
          {active ? (
            <span className="mt-0.5 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-canvas">
                <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-ink-subtle">
                {d.status === "paused" ? t("Paused") : `${pct}%`}
              </span>
            </span>
          ) : (
            <span
              className={`text-[10.5px] ${
                d.status === "done"
                  ? "text-accent"
                  : d.status === "error"
                    ? "text-danger"
                    : "text-ink-subtle"
              }`}
            >
              {d.status === "done"
                ? t("Completed")
                : d.status === "error"
                  ? d.error ?? t("Failed")
                  : d.status === "interrupted"
                    ? t("Interrupted")
                    : t("Canceled")}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        {d.status === "downloading" && (
          <>
            <RowBtn label={t("Pause")} onClick={() => pauseDownload(d.id)}>
              <Pause size={14} strokeWidth={2.2} />
            </RowBtn>
            <RowBtn label={t("Cancel")} onClick={() => cancelDownload(d.id)}>
              <X size={14} strokeWidth={2.2} />
            </RowBtn>
          </>
        )}
        {d.status === "paused" && (
          <>
            <RowBtn label={t("Resume")} onClick={() => void resumeDownload(d.id)}>
              <Play size={14} strokeWidth={2.2} />
            </RowBtn>
            <RowBtn label={t("Cancel")} onClick={() => cancelDownload(d.id)}>
              <X size={14} strokeWidth={2.2} />
            </RowBtn>
          </>
        )}
        {d.status === "done" && (
          <RowBtn label={t("Show in folder")} onClick={() => void revealDownload(d.id)}>
            <FolderOpen size={14} strokeWidth={2} />
          </RowBtn>
        )}
        {(d.status === "error" || d.status === "canceled" || d.status === "interrupted") && (
          <RowBtn label={t("Remove")} onClick={() => removeDownload(d.id)}>
            <Trash2 size={14} strokeWidth={2} />
          </RowBtn>
        )}
      </div>
    </div>
  );
}

function RowBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle opacity-0 transition-all hover:bg-canvas/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
    >
      {children}
    </button>
  );
}
