import { AppWindow, Check, Clock3, Hourglass, Timer } from "lucide-react";
import { useState } from "react";
import { ClockDisplay, FullscreenClock } from "@/components/player/fullscreen-clock";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_FULLSCREEN_CLOCK_SIZE_PX,
  FULLSCREEN_CLOCK_SIZE_MAX_PX,
  FULLSCREEN_CLOCK_SIZE_MIN_PX,
  type FullscreenClockFormat,
  type FullscreenClockStyle,
} from "@/lib/local-time";
import { useSettings } from "@/lib/settings";
import { Segmented, ToggleRow } from "../shared";
import { SettingGroup } from "../kit";
import { SliderRow } from "./display-section";

const CLOCK_FORMATS: ReadonlyArray<{ value: FullscreenClockFormat; label: string }> = [
  { value: "system", label: "System" },
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];

const CLOCK_STYLES: ReadonlyArray<{
  value: FullscreenClockStyle;
  label: string;
  description: string;
}> = [
  { value: "glass", label: "Glass", description: "Soft blur with a floating pill." },
  { value: "minimal", label: "Minimal", description: "Time only, with a subtle shadow." },
  { value: "solid", label: "Solid", description: "High-contrast panel for busy scenes." },
  { value: "accent", label: "Accent", description: "Uses your theme's accent color." },
];

export function FullscreenClockSettings() {
  const t = useT();
  const { settings, update } = useSettings();
  const [previewDate] = useState(() => new Date(2026, 6, 31, 20, 42, 18));

  return (
    <div className="flex flex-col gap-2">
      <ToggleRow
        label={t("Show fullscreen clock")}
        sub={t("The clock appears with the player controls.")}
        value={settings.fullscreenClockEnabled}
        onChange={(fullscreenClockEnabled) => update({ fullscreenClockEnabled })}
        leading={<Clock3 size={18} strokeWidth={2} />}
      />

      {settings.fullscreenClockEnabled && (
        <SettingGroup>
          <div className="flex flex-col gap-3">
            <span className="harbor-settings-label">{t("Live preview")}</span>
            <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-[10px] bg-canvas">
              <div className="relative">
                <FullscreenClock variant="preview" />
              </div>
            </div>
          </div>

          <SettingGroup label={t("Clock format")}>
            <Segmented
              value={settings.fullscreenClockFormat}
              options={CLOCK_FORMATS.map((o) => ({ ...o, label: t(o.label) }))}
              onChange={(fullscreenClockFormat) => update({ fullscreenClockFormat })}
            />
          </SettingGroup>

          <ToggleRow
            label={t("Show seconds")}
            sub={t("Update the clock every second.")}
            value={settings.fullscreenClockShowSeconds}
            onChange={(fullscreenClockShowSeconds) => update({ fullscreenClockShowSeconds })}
            leading={<Timer size={18} strokeWidth={2} />}
          />

          <ToggleRow
            label={t("Show in windowed mode")}
            sub={t("Keep the clock on screen when the player is not fullscreen.")}
            value={settings.fullscreenClockWindowed}
            onChange={(fullscreenClockWindowed) => update({ fullscreenClockWindowed })}
            leading={<AppWindow size={18} strokeWidth={2} />}
          />

          <ToggleRow
            label={t("Show estimated finish time")}
            sub={t("Display the local time when the current video is expected to end.")}
            value={settings.fullscreenClockShowEndTime}
            onChange={(fullscreenClockShowEndTime) => update({ fullscreenClockShowEndTime })}
            leading={<Hourglass size={18} strokeWidth={2} />}
          />

          <SliderRow
            label={t("Clock size")}
            value={settings.fullscreenClockSizePx}
            min={FULLSCREEN_CLOCK_SIZE_MIN_PX}
            max={FULLSCREEN_CLOCK_SIZE_MAX_PX}
            step={1}
            readout={`${settings.fullscreenClockSizePx} px`}
            resetTo={DEFAULT_FULLSCREEN_CLOCK_SIZE_PX}
            onChange={(fullscreenClockSizePx) => update({ fullscreenClockSizePx })}
          />

          <SettingGroup label={t("Clock style")}>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {CLOCK_STYLES.map((option) => {
                const active = settings.fullscreenClockStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ fullscreenClockStyle: option.value })}
                    className={`group overflow-hidden rounded-[10px] border bg-elevated text-start transition-[border-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "border-accent" : "border-edge-soft hover:border-edge"
                    }`}
                  >
                    <span className="relative flex h-24 items-center justify-center overflow-hidden bg-canvas">
                      <span className="relative" aria-hidden="true">
                        <ClockDisplay
                          date={previewDate}
                          format={settings.fullscreenClockFormat}
                          showSeconds={settings.fullscreenClockShowSeconds}
                          style={option.value}
                          sizePx={settings.fullscreenClockSizePx}
                          variant="preview"
                        />
                      </span>
                    </span>
                    <span className="flex min-h-11 items-start gap-3 px-4 py-3.5">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[16.5px] font-medium leading-[24px] text-ink">
                          {t(option.label)}
                        </span>
                        <span className="text-[15.5px] leading-[22px] text-ink-muted">
                          {t(option.description)}
                        </span>
                      </span>
                      {active && (
                        <Check size={18} strokeWidth={2.6} className="mt-[3px] shrink-0 text-accent" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingGroup>
        </SettingGroup>
      )}
    </div>
  );
}
