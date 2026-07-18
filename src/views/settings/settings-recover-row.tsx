import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { applyLegacyToActive, recoverableLegacyBlob } from "@/lib/settings/profile-store";
import type { Settings } from "@/lib/settings/types";
import { useT } from "@/lib/i18n";

const KEY_FIELDS = ["rdKey", "tbKey", "adKey", "pmKey", "dlKey", "tmdbKey", "rpdbKey"] as const;

function legacyDiffers(blob: string, cur: Settings): boolean {
  try {
    const p = JSON.parse(blob) as Partial<Settings>;
    const t = (p.theme ?? {}) as Partial<Settings["theme"]>;
    if ((t.preset ?? "") !== cur.theme.preset) return true;
    if ((t.fontPair ?? "") !== cur.theme.fontPair) return true;
    if (JSON.stringify(t.customColors ?? null) !== JSON.stringify(cur.theme.customColors ?? null))
      return true;
    for (const k of KEY_FIELDS) {
      if (((p[k] as string) ?? "") !== ((cur[k] as string) ?? "")) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function SettingsRecoverRow() {
  const t = useT();
  const { settings } = useSettings();
  const [applying, setApplying] = useState(false);
  const blob = useMemo(() => recoverableLegacyBlob(), []);
  const show = blob != null && legacyDiffers(blob, settings);
  if (!show) return null;

  const restore = () => {
    setApplying(true);
    if (applyLegacyToActive()) {
      window.setTimeout(() => window.location.reload(), 200);
    } else {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{t("Restore previous settings")}</span>
        <span className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Updating separated settings per profile, which may have reset your theme and keys. Harbor still has your old setup saved. Bring it back on this profile, then reload.",
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={restore}
        disabled={applying}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-semibold text-canvas transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60"
      >
        <History size={14} strokeWidth={2.4} />
        {applying ? t("Restoring...") : t("Restore")}
      </button>
    </div>
  );
}
