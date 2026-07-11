import { loadBackups, type AddonOrderBackup } from "@/lib/addons-store/reorder";
import { useT } from "@/lib/i18n";
import { ArchiveRestore } from "lucide-react";
import { useMemo } from "react";

function previewNames(names: string[], t: (key: string, vars?: Record<string, string | number>) => string): string {
  const first = names.slice(0, 3).join(", ");
  return names.length > 3 ? t("{names} +{n} more", { names: first, n: names.length - 3 }) : first;
}

function timeLabel(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BackupsPanel({
  refreshKey,
  busy,
  canBackup,
  onBackupNow,
  onRestore,
}: {
  refreshKey: number;
  busy: boolean;
  canBackup: boolean;
  onBackupNow: () => void;
  onRestore: (backup: AddonOrderBackup) => void;
}) {
  const t = useT();
  const backups = useMemo(() => loadBackups(), [refreshKey]);
  return (
    <div className="flex flex-col gap-4 p-5">
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {t(
          "A safety copy of your addon order. One is saved automatically before Harbor writes any change, and you can save one yourself any time. The five most recent are kept.",
        )}
      </p>
      <button
        onClick={onBackupNow}
        disabled={!canBackup || busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArchiveRestore size={16} strokeWidth={2.2} />
        {t("Back up current order")}
      </button>
      {backups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge-soft bg-canvas/30 px-4 py-3 text-[13px] text-ink-subtle">
          {t("No backups yet. Press the button above to save your first one.")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {backups.map((b) => (
            <div
              key={b.at}
              className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{timeLabel(b.at)}</span>
                  <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                    {t("{n} addons", { n: b.urls.length })}
                  </span>
                </span>
                <span className="truncate text-[11.5px] text-ink-subtle">{previewNames(b.names, t)}</span>
              </div>
              <button
                onClick={() => onRestore(b)}
                disabled={busy}
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("Restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
