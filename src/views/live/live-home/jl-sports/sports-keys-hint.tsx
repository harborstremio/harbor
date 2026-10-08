import { KeyRound, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { hasAnySportsKey } from "@/lib/jl/sports/sports-keys";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

/** Points to Settings → Sports plugins & keys until the viewer saves a key or dismisses it. */
export function SportsKeysHint() {
  const t = useT();
  const { settings, update } = useSettings();
  const { openSettings } = useView();
  if (settings.sportsKeysHintDismissed || hasAnySportsKey(settings)) return null;
  return (
    <span className="flex h-8 items-center rounded-full border border-accent/30 bg-accent-soft text-[12px] font-medium text-accent">
      <button
        onClick={() => openSettings("sports")}
        title={t("Add your sports keys for fan art and odds")}
        className="flex h-full items-center gap-1.5 rounded-full ps-3 pe-2 transition-opacity hover:opacity-85"
      >
        <KeyRound size={13} />
        {t("Sports keys")}
      </button>
      <button
        onClick={() => update({ sportsKeysHintDismissed: true })}
        aria-label={t("Dismiss")}
        className="flex h-full items-center rounded-full pe-2.5 ps-1 transition-opacity hover:opacity-85"
      >
        <X size={12} />
      </button>
    </span>
  );
}
