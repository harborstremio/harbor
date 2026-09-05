import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { applyLegacyToActive, recoverableLegacyBlob } from "@/lib/settings/profile-store";
import type { Settings } from "@/lib/settings/types";
import { useT } from "@/lib/i18n";
import { SettingRow } from "./kit";
import { SButton } from "./ui";

const KEY_FIELDS = ["rdKey", "tbKey", "adKey", "pmKey", "dlKey", "tmdbKey", "rpdbKey"] as const;

function legacyDiffers(blob: string, cur: Settings): boolean {
  try {
    const p = JSON.parse(blob) as Partial<Settings>;
    const t = (p.theme ?? {}) as Partial<Settings["theme"]>;
    if ((t.preset ?? "") !== cur.theme.preset) return true;
    if ((t.fontPair ?? "") !== cur.theme.fontPair) return true;
    if (JSON.stringify(t.customColors ?? null) !== JSON.stringify(cur.theme.customColors ?? null)) return true;
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
    <SettingRow
      icon={<History size={20} strokeWidth={2.1} className="text-accent" />}
      label={t("Restore previous settings")}
      desc={t(
        "Updating separated settings per profile, which may have reset your theme and keys. Harbor still has your old setup saved. Bring it back on this profile, then reload.",
      )}
    >
      <SButton variant="primary" onClick={restore} disabled={applying}>
        <History size={18} strokeWidth={2.4} />
        {applying ? t("Restoring...") : t("Restore")}
      </SButton>
    </SettingRow>
  );
}
