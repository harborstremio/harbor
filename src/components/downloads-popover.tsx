import { Download, Ellipsis, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DownloadCancelIcon, DownloadPauseResumeIcon } from "@/components/download-action-icons";
import { HarborLoader } from "@/components/harbor-loader";
import type { Meta } from "@/lib/cinemeta";
import {
  downloadCapabilities,
  useDownloads,
  type DownloadItem,
} from "@/lib/download/downloads-store";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useContextMenu } from "@/lib/context-menu";
import { useDownloadItemActions } from "@/views/downloads/download-actions";

type T = (key: string) => string;

export function DownloadsButton() {
  const downloads = useDownloads();
  const t = useT();
  const { openMeta, setView } = useView();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const activeCount = downloads.filter(
    (d) => d.status === "downloading" || d.status === "paused",
  ).length;
  const downloadingCount = downloads.filter((d) => d.status === "downloading").length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
    if (d.kind === "ebook") {
      setView("downloads");
      return;
    }
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
        ref={triggerRef}
        type="button"
        aria-label={t("Downloads")}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
        className={`harbor-navbtn relative flex h-11 w-11 items-center justify-center rounded-xl transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none ${
          downloadingCount > 0
            ? "bg-transparent text-accent hover:bg-elevated/50"
            : "bg-elevated/70 text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        {downloadingCount > 0 ? (
          <HarborLoader size="xs" />
        ) : (
          <Download size={17} strokeWidth={1.9} />
        )}
        {activeCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-canvas">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          id={popoverId}
          role="region"
          aria-label={t("Downloads")}
          className="absolute end-0 top-[calc(100%+8px)] z-50 w-[20rem] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[13.5px] font-semibold text-ink">{t("Downloads")}</span>
            <button
              type="button"
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

function compactEta(d: DownloadItem): string | null {
  if (d.status !== "downloading" || d.bytesPerSec <= 0 || d.totalBytes == null) return null;
  const remainingBytes = Math.max(0, d.totalBytes - d.receivedBytes);
  const seconds = Math.max(1, Math.ceil(remainingBytes / d.bytesPerSec));
  if (seconds < 60) return `${seconds}s left`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""} left`;
}

function DownloadRow({ d, t, onOpen }: { d: DownloadItem; t: T; onOpen: () => void }) {
  const contextMenu = useContextMenu();
  const { source, run, pending } = useDownloadItemActions(d.id, d.title);
  const caps = downloadCapabilities(d.id);
  const pct = d.totalBytes
    ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100))
    : Math.round(d.ratio * 100);
  const active = d.status === "downloading" || d.status === "paused";
  const eta = compactEta(d);
  return (
    <div
      onContextMenu={(event) => contextMenu.open(event, source)}
      onKeyDown={(event) => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        contextMenu.open(
          new MouseEvent("contextmenu", { clientX: rect.left + 16, clientY: rect.top + 16 }),
          source,
        );
      }}
      className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-raised/50"
    >
      <button
        type="button"
        onClick={onOpen}
        title={d.kind === "ebook" ? t("Downloads") : t("Go to show")}
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
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-ink-subtle">
                {d.status === "paused" ? t("Paused") : `${pct}%${eta ? ` · ${eta}` : ""}`}
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
                  ? (d.error ?? t("Failed"))
                  : d.status === "interrupted"
                    ? t("Interrupted")
                    : t("Canceled")}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        {active && (
          <>
            {(caps?.pause || caps?.resume) && (
              <RowBtn
                label={d.status === "paused" ? t("Resume") : t("Pause")}
                onClick={() => run(d.status === "paused" ? "resume" : "pause")}
                disabled={pending}
              >
                <DownloadPauseResumeIcon paused={d.status === "paused"} size={14} />
              </RowBtn>
            )}
            <RowBtn
              label={t("Cancel")}
              onClick={() => run("cancel")}
              disabled={pending || !caps?.cancel}
              cancel
            >
              <DownloadCancelIcon size={14} />
            </RowBtn>
          </>
        )}
        {d.status !== "downloading" && d.status !== "paused" && (
          <>
            {caps?.reveal && (
              <RowBtn label={t("Show in folder")} onClick={() => run("reveal")} disabled={pending}>
                <FolderOpen size={14} strokeWidth={2} />
              </RowBtn>
            )}
            <RowBtn
              label={
                caps?.printReceipt ? t("Remove from downloads") : t("Delete download and file")
              }
              onClick={() => run("delete")}
              disabled={pending || !caps?.delete}
              danger
            >
              <Trash2 size={14} strokeWidth={2} className="download-delete-icon" />
            </RowBtn>
          </>
        )}
        <button
          type="button"
          aria-label={t("More actions")}
          title={t("More actions")}
          aria-haspopup="menu"
          aria-expanded={
            contextMenu.state?.target.kind === "actions" &&
            contextMenu.state.target.id === source.id
          }
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            contextMenu.openAt({ x: rect.left, y: rect.bottom }, source);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <Ellipsis size={14} />
        </button>
      </div>
    </div>
  );
}

function RowBtn({
  label,
  onClick,
  danger = false,
  cancel = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  cancel?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
        danger
          ? "download-delete-trigger text-danger hover:bg-danger/10 hover:text-danger"
          : cancel
            ? "download-cancel-trigger text-ink-subtle hover:bg-danger/10 hover:text-danger"
            : "text-ink-subtle hover:bg-canvas/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
