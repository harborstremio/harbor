import { Check, Download, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  applyBackup,
  backupKeyCount,
  downloadBackup,
  parseBackup,
  type Backup,
} from "@/lib/backup";
import { useT } from "@/lib/i18n";

export function BackupRow() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [applying, setApplying] = useState(false);

  const doExport = async () => {
    setError(null);
    try {
      const saved = await downloadBackup();
      if (saved) {
        setExported(true);
        window.setTimeout(() => setExported(false), 1600);
      }
    } catch {
      setError("Could not build the backup file.");
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseBackup(typeof reader.result === "string" ? reader.result : "");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPending(res.backup);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!pending) return;
    setApplying(true);
    void applyBackup(pending).then(() => {
      window.setTimeout(() => window.location.reload(), 280);
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={fileRef}
        type="file"
        accept=".harbx,application/json,.json"
        onChange={onFile}
        className="hidden"
      />

      <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">{t("Export everything")}</span>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Saves your whole Harbor setup to one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.",
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={doExport}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold transition-all ${
            exported
              ? "bg-accent/15 text-accent"
              : "bg-ink text-canvas hover:scale-[1.02] active:scale-[0.97]"
          }`}
        >
          {exported ? (
            <Check size={14} strokeWidth={2.6} />
          ) : (
            <Download size={14} strokeWidth={2.4} />
          )}
          {exported ? t("Saved") : t("Export")}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">{t("Restore from a backup")}</span>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Loads a backup file and replaces your current setup with it. Perfect for a new computer. Your Stremio sign-in on this device stays as is.",
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3.5 text-[12.5px] font-semibold text-ink transition-all hover:scale-[1.02] hover:border-ink active:scale-[0.97]"
        >
          <Upload size={14} strokeWidth={2.4} />
          {t("Restore")}
        </button>
      </div>

      {error && <p className="px-1 text-[12px] text-danger">{error}</p>}

      {pending && (
        <RestoreConfirm
          backup={pending}
          applying={applying}
          onConfirm={confirmRestore}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function RestoreConfirm({
  backup,
  applying,
  onConfirm,
  onCancel,
}: {
  backup: Backup;
  applying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const when = backup.exportedAt
    ? new Date(backup.exportedAt).toLocaleString()
    : t("an unknown date");
  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !applying) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="modal-panel w-full max-w-md rounded-2xl border border-edge-soft bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          {t("Restore this backup?")}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "This replaces your current Harbor setup (theme, home layout, settings, addons, profiles, and more) with the {n} saved entries in this file. Your Stremio sign-in stays as is. Harbor reloads when it finishes.",
            { n: String(backupKeyCount(backup)) },
          )}
        </p>
        <p className="mt-2 text-[12px] text-ink-subtle">
          {t("Saved {when} from Harbor {app}.", { when, app: backup.app })}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-50"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying}
            className="h-10 rounded-full bg-accent px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {applying ? t("Restoring...") : t("Restore and reload")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
