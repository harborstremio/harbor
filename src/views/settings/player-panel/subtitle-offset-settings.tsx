import { Captions } from "lucide-react";
import { SubtitleOffsetIndicator } from "@/components/player/subtitle-offset-indicator";
import { useT } from "@/lib/i18n";
import type { SubtitleOffsetPosition, SubtitleOffsetSize } from "@/lib/player/subtitle-offset";
import { useSettings } from "@/lib/settings";
import { Segmented, ToggleRow } from "../shared";
import { SettingGroup } from "../kit";

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
  "top-left": "start-1 top-1",
  top: "start-1/2 top-1 -translate-x-1/2 rtl:translate-x-1/2",
  "top-right": "end-1 top-1",
  left: "start-1 top-1/2 -translate-y-1/2",
  center: "start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
  right: "end-1 top-1/2 -translate-y-1/2",
  "bottom-left": "bottom-1 start-1",
  bottom: "bottom-1 start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
  "bottom-right": "bottom-1 end-1",
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
    <div className="flex flex-col gap-5">
      <ToggleRow
        label={t("Show subtitle sync indicator")}
        sub={t(
          "Puts the current offset on screen while you nudge subtitle timing with Z or X, so you can see how far you have shifted them.",
        )}
        value={settings.subOffsetIndicatorEnabled}
        onChange={(subOffsetIndicatorEnabled) => update({ subOffsetIndicatorEnabled })}
        leading={<Captions size={18} strokeWidth={2} />}
      />

      {settings.subOffsetIndicatorEnabled && (
        <>
          <div className="relative h-56 overflow-hidden rounded-[10px] border border-edge-soft bg-canvas">
            <div className="absolute inset-0 bg-gradient-to-br from-elevated via-canvas to-accent-soft" />
            <span className="harbor-settings-label absolute start-4 top-4">{t("Preview")}</span>
            <SubtitleOffsetIndicator delaySec={0.3} preview />
          </div>

          <SettingGroup label={t("Position")}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {POSITION_OPTIONS.map((option) => {
                const active = settings.subOffsetIndicatorPosition === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ subOffsetIndicatorPosition: option.value })}
                    className={`flex min-h-14 items-center gap-2.5 rounded-[10px] border px-3 text-start transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      active
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
                    }`}
                  >
                    <span className="relative h-7 w-11 shrink-0 rounded-[6px] border border-edge-soft bg-canvas">
                      <span
                        className={`absolute size-2 rounded-full ${
                          active ? "bg-accent" : "bg-ink-subtle"
                        } ${POSITION_DOT_CLASSES[option.value]}`}
                      />
                    </span>
                    <span className="min-w-0 text-[15.5px] font-medium leading-[20px]">
                      {t(option.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingGroup>

          <SettingGroup label={t("Size")}>
            <Segmented
              value={settings.subOffsetIndicatorSize}
              options={SIZE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
              onChange={(subOffsetIndicatorSize) => update({ subOffsetIndicatorSize })}
            />
          </SettingGroup>
        </>
      )}
    </div>
  );
}
