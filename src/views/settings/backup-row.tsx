import { AlertTriangle, Check, Download, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  applyBackup,
  BACKUP_SECTIONS,
  backupKeyCount,
  backupSectionDescription,
  backupSectionLabel,
  backupSections,
  downloadBackup,
  parseBackup,
  type Backup,
  type BackupSectionKey,
} from "@/lib/backup";
import { useT } from "@/lib/i18n";

export function BackupRow() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [applying, setApplying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const doExport = async (selected: BackupSectionKey[]) => {
    setError(null);
    setPickerOpen(false);
    try {
      const saved = await downloadBackup(selected);
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
          <span className="text-[14px] font-medium text-ink">{t("Export your setup")}</span>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Pick what to save, then everything you choose lands in one file: theme, home layout, settings, addons, profiles, watchlist, player layouts, watch progress, and more. Your Stremio sign-in is left out on purpose.",
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
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
              "Loads a backup file and restores exactly what it contains, without touching the rest of your setup. Your Stremio sign-in on this device stays as is.",
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

      {pickerOpen && <ExportPicker onExport={doExport} onCancel={() => setPickerOpen(false)} />}

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

function ExportPicker({
  onExport,
  onCancel,
}: {
  onExport: (selected: BackupSectionKey[]) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<BackupSectionKey>>(
    () => new Set(BACKUP_SECTIONS.map((s) => s.key)),
  );

  const allSelected = selected.size === BACKUP_SECTIONS.length;
  const toggle = (key: BackupSectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(BACKUP_SECTIONS.map((s) => s.key)));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="modal-panel w-full max-w-2xl rounded-2xl border border-edge-soft bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          {t("What should the backup include?")}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "Everything you pick is saved into one file. Restoring it later only touches what is in the file. Your Stremio sign-in is always left out.",
          )}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <Check
              size={13}
              strokeWidth={2.6}
              className={allSelected ? "text-accent" : "opacity-40"}
            />
            {allSelected ? t("All selected") : t("Select all")}
          </button>
          <span className="text-[11.5px] tabular-nums text-ink-subtle">
            {t("{n} of {total} chosen", { n: selected.size, total: BACKUP_SECTIONS.length })}
          </span>
        </div>

        <div className="mt-2 grid max-h-[52vh] grid-cols-1 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-2">
          {BACKUP_SECTIONS.map((section) => (
            <div
              key={section.key}
              className="rounded-lg border border-edge-soft/60 bg-canvas/30 px-3.5 py-2.5 transition-colors hover:bg-raised/70"
            >
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(section.key)}
                  onChange={() => toggle(section.key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                />
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-ink">
                    {t(backupSectionLabel(section.key))}
                  </span>
                  {section.warning && (
                    <AlertTriangle
                      size={13}
                      strokeWidth={2.4}
                      className="shrink-0 text-amber-500"
                      aria-label={t("contains login credentials")}
                    />
                  )}
                </span>
              </label>
              <p className="ms-6.5 mt-0.5 text-[11.5px] leading-snug text-ink-subtle">
                {t(backupSectionDescription(section.key))}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => onExport([...selected])}
            disabled={selected.size === 0}
            className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} strokeWidth={2.4} />
            {t("Export {n} sections", { n: selected.size })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
  const sections = backupSections(backup);
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
            "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.",
            { n: String(backupKeyCount(backup)) },
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sections.map((key) => (
            <span
              key={key}
              className="rounded-full border border-edge-soft bg-canvas/40 px-2.5 py-1 text-[11.5px] font-medium text-ink-subtle"
            >
              {t(backupSectionLabel(key))}
            </span>
          ))}
        </div>
        {backup.sections?.includes("iptv") && !backup.sections.includes("iptvCredentials") && (
          <p className="mt-3 text-[12px] text-ink-subtle">
            {t("Xtream credentials were left out of this backup.")}
          </p>
        )}
        <p className="mt-3 text-[12px] text-ink-subtle">
          {t("Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.", {
            when,
            app: backup.app,
          })}
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
