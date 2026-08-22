import { Rss, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAutoDownload } from "@/lib/auto-download";
import { runAutoDownloadCheck, useIsRunning } from "@/lib/auto-download/runner";
import { AutoDownloadAdd } from "./auto-download-add";
import { AutoDownloadRow } from "./auto-download-row";

export function AutoDownloadButton() {
  const list = useAutoDownload();
  const running = useIsRunning();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-edge-soft bg-elevated/50 px-3 text-[12.5px] font-medium text-ink-muted transition duration-150 hover:border-edge hover:text-ink active:scale-[0.97]"
      >
        {running ? (
          <RotateCw size={14} strokeWidth={2.2} className="shrink-0 animate-spin text-accent" />
        ) : (
          <Rss size={14} strokeWidth={2.1} className="shrink-0 text-ink-subtle" />
        )}
        Auto-download
        {list.length > 0 && (
          <span className="rounded-full bg-accent/15 px-1.5 py-px text-[11px] font-semibold tabular-nums text-accent">
            {list.length}
          </span>
        )}
      </button>
      {open && <AutoDownloadModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function AutoDownloadModal({ onClose }: { onClose: () => void }) {
  const list = useAutoDownload();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80 px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Auto-download"
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[min(80vh,640px)] w-[min(92vw,560px)] flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
              Auto-download
            </h2>
            <p className="text-[13px] leading-snug text-ink-muted">
              New episodes grab themselves in the background
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {list.length > 0 && <CheckNowButton />}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition duration-150 hover:bg-ink/10 hover:text-ink active:scale-90"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="px-6 pt-5">
          <AutoDownloadAdd />
        </div>

        <div className="min-h-[300px] flex-1 overflow-y-auto px-6 pb-6">
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-5 py-8 text-center text-[13px] leading-relaxed text-ink-muted">
              Add a series above and Harbor will grab each new episode as it airs, on your terms.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {list.map((s) => (
                <AutoDownloadRow key={s.id} series={s} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CheckNowButton() {
  const running = useIsRunning();
  return (
    <button
      type="button"
      onClick={() => void runAutoDownloadCheck(true)}
      disabled={running}
      className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-edge bg-canvas/40 px-3.5 text-[12.5px] font-medium text-ink-muted transition duration-150 hover:border-ink-subtle hover:text-ink active:scale-[0.97] disabled:opacity-60"
    >
      <RotateCw size={13} strokeWidth={2.2} className={running ? "animate-spin" : ""} />
      {running ? "Checking..." : "Check now"}
    </button>
  );
}
