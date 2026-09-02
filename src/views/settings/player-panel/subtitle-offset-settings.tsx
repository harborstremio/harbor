import { Captions } from "lucide-react";
import { SubtitleOffsetIndicator } from "@/components/player/subtitle-offset-indicator";
import { useT } from "@/lib/i18n";
import type { SubtitleOffsetPosition, SubtitleOffsetSize } from "@/lib/player/subtitle-offset";
import { useSettings } from "@/lib/settings";
import { Segmented, ToggleRow } from "../shared";

const POSITION_OPTIONS: ReadonlyArray<{ value: SubtitleOffsetPosition; label: string }> = [
  { value: "top-left", label: "Top left" },
  { value: "top", label: "Top" },
  { value: "top-right", label: "Top right" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom", label: "Bottom" },
  { value: "bottom-right", label: "Bottom right" },
];

const POSITION_DOT_CLASSES: Record<SubtitleOffsetPosition, string> = {
  "top-left": "left-1 top-1",
  top: "left-1/2 top-1 -translate-x-1/2",
  "top-right": "right-1 top-1",
  left: "left-1 top-1/2 -translate-y-1/2",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "right-1 top-1/2 -translate-y-1/2",
  "bottom-left": "bottom-1 left-1",
  bottom: "bottom-1 left-1/2 -translate-x-1/2",
  "bottom-right": "right-1 bottom-1",
};

const SIZE_OPTIONS: ReadonlyArray<{ value: SubtitleOffsetSize; label: string }> = [
  { value: "small", label: "Smaller" },
  { value: "medium", label: "Default" },
  { value: "large", label: "Larger" },
];

export function SubtitleOffsetSettings() {
  const t = useT();
  const { settings, update } = useSettings();

  return (
    <div className="flex flex-col gap-4">
      <ToggleRow
        label={t("Show subtitle sync indicator")}
        sub={t("Show the current offset when you adjust subtitle timing with Z or X.")}
        value={settings.subOffsetIndicatorEnabled}
        onChange={(subOffsetIndicatorEnabled) => update({ subOffsetIndicatorEnabled })}
        leading={
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              settings.subOffsetIndicatorEnabled
                ? "bg-accent-soft text-accent"
                : "bg-raised text-ink-subtle"
            }`}
          >
            <Captions size={16} strokeWidth={2} />
          </span>
        }
      />

      {settings.subOffsetIndicatorEnabled && (
 <div className="flex flex-col gap-5 rounded-md bg-canvas p-5">
          <div className="relative isolate h-40 overflow-hidden rounded-md border border-white/10 bg-[#080b10]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-accent/[0.07]" />
            <span className="absolute start-4 top-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {t("Preview")}
            </span>
            <SubtitleOffsetIndicator delaySec={0.3} preview />
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("Position")}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {POSITION_OPTIONS.map((option) => {
                const active = settings.subOffsetIndicatorPosition === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ subOffsetIndicatorPosition: option.value })}
                    className={`flex min-h-14 items-center gap-2.5 rounded-md px-3 text-start ring-1 transition-[background-color,box-shadow,color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active
                        ? "bg-accent-soft text-ink ring-accent"
                        : "bg-elevated text-ink-muted ring-edge-soft hover:bg-elevated hover:text-ink hover:ring-edge"
                    }`}
                  >
                    <span className="relative h-6 w-9 shrink-0 rounded-md bg-canvas ring-1 ring-edge-soft">
                      <span
                        className={`absolute size-1.5 rounded-full ${
                          active ? "bg-accent" : "bg-ink-subtle"
                        } ${POSITION_DOT_CLASSES[option.value]}`}
                      />
                    </span>
                    <span className="text-[12.5px] font-semibold leading-tight">
                      {t(option.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("Size")}
            </legend>
            <Segmented
              value={settings.subOffsetIndicatorSize}
              options={SIZE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
              onChange={(subOffsetIndicatorSize) => update({ subOffsetIndicatorSize })}
            />
          </fieldset>
        </div>
      )}
    </div>
  );
}
