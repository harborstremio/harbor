import { Star } from "lucide-react";
import { ColorPopoverTrigger } from "@/views/settings/color-picker";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const PRESETS = [
  "#e4e7ec",
  "#94a3b8",
  "#6b8cc4",
  "#4fa8a0",
  "#7fb069",
  "#e6b15a",
  "#e0876b",
  "#d98aa6",
  "#9a8ac4",
];

export function AvatarBgControl({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const t = useT();
  const { settings } = useSettings();
  const harborColor = settings.harborColor;
  const usingHarbor = !!harborColor && value.toLowerCase() === harborColor.toLowerCase();
  const isPreset = PRESETS.includes(value.toLowerCase());
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-ink-subtle">
        {t("Background")}
      </span>
      <div className="flex items-center gap-1.5">
        {harborColor && (
          <>
            <button
              type="button"
              onClick={() => onChange(harborColor)}
              aria-label={t("Use your Harbor color")}
              title={t("Use your Harbor color")}
              className={`flex h-[18px] w-[18px] items-center justify-center transition-transform duration-150 hover:scale-110 motion-reduce:hover:scale-100 ${
                usingHarbor ? "text-accent" : "text-ink-subtle hover:text-ink"
              }`}
            >
              <Star size={16} strokeWidth={2} fill={usingHarbor ? "currentColor" : "none"} />
            </button>
            <span className="mx-0.5 h-3.5 w-px bg-edge-soft" />
          </>
        )}
        {PRESETS.map((c) => {
          const active = value.toLowerCase() === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={c}
              style={{ background: c }}
              className={`h-[18px] w-[18px] rounded-[5px] ring-1 ring-inset ring-black/15 transition-transform duration-150 hover:scale-110 motion-reduce:hover:scale-100 ${
                active ? "outline outline-2 outline-offset-[3px] outline-accent" : ""
              }`}
            />
          );
        })}
        <ColorPopoverTrigger
          value={value}
          onChange={onChange}
          label={isPreset || usingHarbor ? t("Custom") : value.toUpperCase()}
          highlighted={!isPreset && !usingHarbor}
          align="right"
          direction="down"
          portal
        />
      </div>
    </div>
  );
}
