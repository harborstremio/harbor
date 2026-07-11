import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

export function DisplayPanelSelector() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold text-ink">{t("Display panel")}</span>
        <span className="text-[11.5px] leading-snug text-ink-subtle">
          {t("Pick OLED for perfect-black panels to unlock shadow detail in tonemapped HDR.")}
        </span>
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-edge-soft">
        {(["auto", "oled", "lcd"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => update({ playerDisplayPanel: p })}
            className={`px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              settings.playerDisplayPanel === p ? "bg-elevated text-ink" : "text-ink-muted hover:bg-canvas/60"
            }`}
          >
            {p === "auto" ? t("Auto") : p.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
