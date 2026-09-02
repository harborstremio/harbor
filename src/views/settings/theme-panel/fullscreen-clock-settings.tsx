import { Check, Clock3 } from "lucide-react";
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
        leading={
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              settings.fullscreenClockEnabled
                ? "bg-accent-soft text-accent"
                : "bg-raised text-ink-subtle"
            }`}
          >
            <Clock3 size={16} strokeWidth={2.2} />
          </span>
        }
      />

      {settings.fullscreenClockEnabled && (
        <SettingGroup>
          <div className="relative isolate flex min-h-32 items-center justify-center overflow-hidden rounded-md bg-[#080b10]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-accent/[0.08]" />
            <span className="absolute start-4 top-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {t("Live preview")}
            </span>
            <div className="relative">
              <FullscreenClock variant="preview" />
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
            leading={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-muted">
                <Clock3 size={16} strokeWidth={2.2} />
              </span>
            }
          />

          <ToggleRow
            label={t("Show in windowed mode")}
            sub={t("Keep the clock on screen when the player is not fullscreen.")}
            value={settings.fullscreenClockWindowed}
            onChange={(fullscreenClockWindowed) => update({ fullscreenClockWindowed })}
            leading={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-muted">
                <Clock3 size={16} strokeWidth={2.2} />
              </span>
            }
          />

          <ToggleRow
            label={t("Show estimated finish time")}
            sub={t("Display the local time when the current video is expected to end.")}
            value={settings.fullscreenClockShowEndTime}
            onChange={(fullscreenClockShowEndTime) => update({ fullscreenClockShowEndTime })}
            leading={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-muted">
                <Clock3 size={16} strokeWidth={2.2} />
              </span>
            }
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
                    className={`group overflow-hidden rounded-md text-start transition-[background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "bg-accent-soft" : "bg-elevated hover:bg-raised"
                    }`}
                  >
                    <span className="relative flex h-20 items-center justify-center overflow-hidden bg-[#080b10]">
                      <span className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-accent/[0.06]" />
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
                    <span className="flex items-start gap-3 px-3.5 py-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[13.5px] font-semibold text-ink">
                          {t(option.label)}
                        </span>
                        <span className="text-[11.5px] leading-relaxed text-ink-subtle">
                          {t(option.description)}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-[background-color,color,opacity] ${
                          active
                            ? "bg-accent text-canvas opacity-100"
                            : "bg-raised text-ink-subtle opacity-0 group-hover:opacity-50"
                        }`}
                      >
                        <Check size={12} strokeWidth={2.8} />
                      </span>
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
