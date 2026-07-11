import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { ArrowRight, X } from "lucide-react";

const KEY = "tmdb-nudge";

export function TmdbNudge({ suppress }: { suppress?: boolean } = {}) {
  const { settings } = useSettings();
  const { isDismissed, dismiss } = useOnboarding();
  const { openSettings } = useView();
  const t = useT();

  if (settings.tmdbKey || isDismissed(KEY) || suppress) return null;

  return (
    <div className="group animate-nudge-in flex items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/95 px-5 py-4 backdrop-blur-md shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)]">
      <img src={tmdbLogo} alt="TMDB" className="h-10 w-10 shrink-0 rounded-full object-cover" draggable={false} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">{t("Add a TMDB key for the full Harbor")}</p>
        <p className="text-[12.5px] text-ink-subtle">
          {t("Free key unlocks Trending, In Theaters, and per-service catalogs. 60 seconds.")}
        </p>
      </div>
      <button
        onClick={() => openSettings("library")}
        className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97]"
      >
        {t("Set up")}
        <ArrowRight size={13} strokeWidth={2.6} className="dir-icon" />
      </button>
      <button
        onClick={() => dismiss(KEY)}
        aria-label={t("Dismiss")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  );
}
