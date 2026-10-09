import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Folder, FolderPlus, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SourceFolder } from "./use-local-scan";

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function FoldersModal({
  isOpen,
  folders,
  busy,
  onClose,
  onAddFolder,
  onRescan,
  onRemove,
}: {
  isOpen: boolean;
  folders: SourceFolder[];
  busy: boolean;
  onClose: () => void;
  onAddFolder: () => void;
  onRescan: (path: string) => void;
  onRemove: (path: string) => void;
}) {
  const t = useT();
  const [removeTarget, setRemoveTarget] = useState<SourceFolder | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (removeTarget) setRemoveTarget(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose, removeTarget]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Your folders")}
      className="pointer-events-auto fixed inset-0 z-[170] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[80vh] w-full max-w-[520px] flex-col gap-5 overflow-hidden rounded-3xl border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Your folders")}</h2>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              {t(
                "Folders Harbor imported your movies and shows from. Rescan to pick up new files.",
              )}
            </p>
          </div>
          <button
            autoFocus
            data-tv-initial-focus
            data-tv-modal-close
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
          {folders.map((f) => (
            <div
              key={f.path}
              className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-canvas/40 px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink-muted ring-1 ring-edge-soft">
                <Folder size={17} strokeWidth={2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-semibold text-ink" title={f.path}>
                  {baseName(f.path)}
                </span>
                <span className="truncate text-[11px] text-ink-subtle" title={f.path}>
                  {f.path}
                </span>
              </div>
              <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">
                {f.count === 1 ? t("1 file") : t("{n} files", { n: f.count })}
              </span>
              <button
                type="button"
                onClick={() => onRescan(f.path)}
                disabled={busy}
                title={t("Rescan")}
                aria-label={t("Rescan")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} strokeWidth={2.2} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setRemoveTarget(f)}
                disabled={busy}
                title={t("Remove folder")}
                aria-label={t("Remove folder")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-muted transition-colors hover:bg-danger hover:text-white disabled:opacity-40"
              >
                <Trash2 size={14} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddFolder}
          disabled={busy}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FolderPlus size={14} strokeWidth={2.2} />
          )}
          {t("Add folder")}
        </button>

        {removeTarget && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Remove folder?")}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/65 px-6 backdrop-blur-sm"
          >
            <div className="w-full max-w-[400px] rounded-2xl border border-edge-soft bg-elevated p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                  <AlertTriangle size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-ink">{t("Remove folder?")}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    {t(
                      "Remove this folder and its {n} items? Files on your disk are not deleted.",
                      { n: removeTarget.count },
                    )}
                  </p>
                  <p
                    className="mt-2 truncate text-[11px] text-ink-subtle"
                    title={removeTarget.path}
                  >
                    {removeTarget.path}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  data-tv-initial-focus
                  data-tv-modal-close
                  onClick={() => setRemoveTarget(null)}
                  className="h-9 rounded-full bg-raised px-4 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(removeTarget.path);
                    setRemoveTarget(null);
                  }}
                  className="h-9 rounded-full bg-danger px-4 text-[12.5px] font-semibold text-white hover:bg-danger/90"
                >
                  {t("Remove")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
