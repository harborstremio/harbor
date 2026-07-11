import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Globe } from "lucide-react";

export function WebSearchButton() {
  const { settings, update } = useSettings();
  const t = useT();
  const active = settings.aiWebSearch;
  return (
    <HoverTooltip label={active ? t("Live web on") : t("Live web off")} side="top" align="center">
      <button
        type="button"
        onClick={() => update({ aiWebSearch: !active })}
        aria-label={t("Toggle live web")}
        aria-pressed={active}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
          active
            ? "border-accent/60 bg-accent/15 text-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
            : "border-edge-soft bg-canvas/60 text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        <Globe size={17} strokeWidth={1.9} />
      </button>
    </HoverTooltip>
  );
}
