import { ArrowDownToLine, Check } from "lucide-react";
import { useState } from "react";
import { BetaTag } from "@/components/beta-tag";
import { useT } from "@/lib/i18n";
import { installerUrl, type VersionEntry } from "@/lib/updater/versions";
import { openUrl } from "@/lib/window";
import { VersionNotesModal } from "./version-notes-modal";

const RELEASES_URL = "https://github.com/harborstremio/harbor/releases";

export function VersionItem({ entry, isCurrent }: { entry: VersionEntry; isCurrent: boolean }) {
  const t = useT();
  const url = installerUrl(entry);
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 ${
        isCurrent ? "bg-accent/[0.07]" : "transition-colors hover:bg-raised/40"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("Show the full notes for this build")}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-start"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold tabular-nums text-ink">{entry.version}</span>
          {entry.channel === "beta" && <BetaTag force />}
          {entry.channel === "stable" && (
            <span className="inline-flex shrink-0 items-center rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted ring-1 ring-edge">
              {t("Stable")}
            </span>
          )}
          {entry.date && <span className="text-[11.5px] text-ink-subtle">{entry.date}</span>}
        </div>
        {entry.notes && (
          <span className="line-clamp-2 text-[11.5px] leading-snug text-ink-subtle">
            {entry.notes}
          </span>
        )}
      </button>

      {isCurrent ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
          <Check size={12} strokeWidth={2.8} />
          {t("Current")}
        </span>
      ) : url ? (
        <button
          type="button"
          title={t("Download this build's installer, then run it over your current copy")}
          onClick={() => openUrl(url)}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3 text-[12px] font-semibold text-ink transition-all hover:scale-[1.02] hover:border-ink active:scale-[0.97]"
        >
          <ArrowDownToLine size={13} strokeWidth={2.4} />
          {t("Download")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openUrl(RELEASES_URL)}
          className="shrink-0 text-[11.5px] font-semibold text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
        >
          {t("Releases")}
        </button>
      )}
      {open && (
        <VersionNotesModal entry={entry} isCurrent={isCurrent} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
