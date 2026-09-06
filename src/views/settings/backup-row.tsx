import { AlertTriangle, Check, Download, Info, Upload } from "./icons";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  type BackupValidationError,
} from "@/lib/backup";
import { useT } from "@/lib/i18n";
import { ROW_DESC, SettingRow, SettingsModal } from "./kit";
import { SButton } from "./ui";

type BackupRowError =
  | BackupValidationError
  | "Could not build the backup file."
  | "Could not read that file.";

export function BackupRow() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<BackupRowError | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [applying, setApplying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restoreError, setRestoreError] = useState(false);

  useEffect(() => {
    if (!exported) return;
    const timer = window.setTimeout(() => setExported(false), 1600);
    return () => window.clearTimeout(timer);
  }, [exported]);

  const doExport = async (selected: BackupSectionKey[]) => {
    setError(null);
    setPickerOpen(false);
    try {
      const saved = await downloadBackup(selected);
      if (saved) {
        setExported(true);
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
      setRestoreError(false);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!pending) return;
    setApplying(true);
    setRestoreError(false);
    void applyBackup(pending).then(() => {
      window.setTimeout(() => window.location.reload(), 280);
    }).catch(() => {
      setApplying(false);
      setRestoreError(true);
    });
  };

  return (
    <>
      <SettingRow
        icon={<Download size={20} strokeWidth={2.1} className="text-ink-muted" />}
        label={t("Export your setup")}
        desc={t(
          "Choose which parts of your setup to save in one backup file. Your Stremio sign-in is excluded.",
        )}
      >
        <SButton variant="primary" onClick={() => setPickerOpen(true)}>
          {exported ? (
            <Check size={16} strokeWidth={2.6} />
          ) : (
            <Download size={16} strokeWidth={2.4} />
          )}
          {exported ? t("Saved") : t("Export")}
        </SButton>
      </SettingRow>

      <SettingRow
        icon={<Upload size={20} strokeWidth={2.1} className="text-ink-muted" />}
        label={t("Restore from a backup")}
        desc={t(
          "Choose a Harbor backup and review what it contains before restoring. Your Stremio sign-in stays on this device.",
        )}
      >
        <SButton onClick={() => fileRef.current?.click()}>
          <Upload size={16} strokeWidth={2.4} />
          {t("Restore")}
        </SButton>
      </SettingRow>

      {error && (
        <p role="alert" className="max-w-[70ch] text-[15.5px] leading-[22px] text-danger">{t(error)}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".harbx,application/json,.json"
        onChange={onFile}
        className="hidden"
      />

      {pickerOpen && <ExportPicker onExport={doExport} onCancel={() => setPickerOpen(false)} />}

      {pending && (
        <RestoreConfirm
          backup={pending}
          applying={applying}
          error={restoreError}
          onConfirm={confirmRestore}
          onCancel={() => setPending(null)}
        />
      )}
    </>
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

  return (
    <SettingsModal
      open
      onClose={onCancel}
      title={t("What should the backup include?")}
      width={800}
      sub={t(
        "Choose the sections to save in one file. Your Stremio sign-in is excluded.",
      )}
      actions={
        <>
          <SButton onClick={onCancel}>{t("Cancel")}</SButton>
          <SButton
            variant="primary"
            disabled={selected.size === 0}
            onClick={() => onExport([...selected])}
          >
            <Download size={16} strokeWidth={2.4} />
            {t("Export {n} sections", { n: selected.size })}
          </SButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleAll}
          className="flex h-11 items-center gap-2 rounded-[8px] px-3 text-[15.5px] font-semibold leading-[22px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <Check
            size={17}
            strokeWidth={2.6}
            className={allSelected ? "text-accent" : "text-ink-subtle"}
          />
          {allSelected ? t("Deselect all") : t("Select all")}
        </button>
        <span className="text-[15.5px] leading-[22px] tabular-nums text-ink-subtle">
          {t("{n} of {total} chosen", { n: selected.size, total: BACKUP_SECTIONS.length })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BACKUP_SECTIONS.map((section) => {
          const on = selected.has(section.key);
          return (
            <label
              key={section.key}
              className={`flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-[10px] border px-3.5 py-3 transition-colors ${
                on ? "border-edge bg-elevated" : "border-edge-soft hover:border-edge"
              }`}
            >
              <span className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(section.key)}
                  className="mt-[5px] h-4 w-4 shrink-0 accent-ink"
                />
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[16.5px] font-medium leading-[24px] text-ink">
                    {t(backupSectionLabel(section.key))}
                  </span>
                  {section.warning && (
                    <AlertTriangle
                      size={16}
                      strokeWidth={2.4}
                      className="shrink-0 text-danger"
                      aria-label={t("contains login credentials")}
                    />
                  )}
                </span>
              </span>
              <span className={`ps-[26px] ${ROW_DESC}`}>
                {t(backupSectionDescription(section.key))}
              </span>
            </label>
          );
        })}
      </div>
    </SettingsModal>
  );
}

function RestoreConfirm({
  backup,
  applying,
  error,
  onConfirm,
  onCancel,
}: {
  backup: Backup;
  applying: boolean;
  error: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const when = backup.exportedAt
    ? new Date(backup.exportedAt).toLocaleString()
    : t("an unknown date");
  const sections = backupSections(backup);

  return (
    <SettingsModal
      open
      onClose={onCancel}
      dismissible={!applying}
      title={t("Restore this backup?")}
      sub={t(
        "This file restores its {n} saved entries and replaces only those parts of your setup. Anything it does not contain stays exactly as it is.",
        { n: String(backupKeyCount(backup)) },
      )}
      actions={
        <>
          <SButton disabled={applying} onClick={onCancel}>
            {t("Cancel")}
          </SButton>
          <SButton variant="primary" disabled={applying} onClick={onConfirm}>
            {applying ? t("Restoring...") : t("Restore and reload")}
          </SButton>
        </>
      }
    >
      {error && <p role="alert" className="text-[15px] text-danger">{t("Restore did not finish. Some settings may already have changed. Free some storage, then try again.")}</p>}
      <div className="flex flex-wrap gap-2">
        {sections.map((key) => (
          <span
            key={key}
            className="rounded-[8px] bg-elevated px-3 py-1.5 text-[15.5px] leading-[22px] text-ink-muted"
          >
            {t(backupSectionLabel(key))}
          </span>
        ))}
      </div>

      {backup.sections?.includes("iptv") && !backup.sections.includes("iptvCredentials") && (
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t("Xtream credentials were left out of this backup.")}
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
        <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t("Saved {when} from Harbor {app}. Your Stremio sign-in stays as is.", {
            when,
            app: backup.app,
          })}
        </p>
      </div>
    </SettingsModal>
  );
}
