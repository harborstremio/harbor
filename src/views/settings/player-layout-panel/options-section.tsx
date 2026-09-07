import { Clock3, Volume2 } from "../icons";
import type { PlayerChromeConfig, ThemeId, TimeFormat, VolumeStyle } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";
import { Segmented } from "../shared";
import { SettingRow } from "../kit";

export function getOptions(t: (k: string) => string) {
  const TIME_OPTIONS: Array<{ id: TimeFormat; label: string; sub: string }> = [
    { id: "start-end", label: t("Elapsed and total"), sub: t("Shows elapsed time and the full duration.") },
    { id: "remaining", label: t("Elapsed and remaining"), sub: t("Shows elapsed time and how much is left.") },
    { id: "elapsed-only", label: t("Elapsed only"), sub: t("Shows elapsed time without a second time label.") },
  ];

  const VOLUME_OPTIONS: Array<{ id: VolumeStyle; label: string; sub: string }> = [
    { id: "slider", label: t("Slider"), sub: t("Hover the speaker to reveal a horizontal slider.") },
    { id: "vertical", label: t("Vertical"), sub: t("A compact upright slider that boosts past 100 percent.") },
    { id: "stepper", label: t("Stepper"), sub: t("Click to cycle 100 / 75 / 50 / 25 / 0.") },
    { id: "icon-only", label: t("Icon only"), sub: t("Click toggles mute. Wheel scrolls volume.") },
  ];
  return { TIME_OPTIONS, VOLUME_OPTIONS };
}

type Props = {
  config: PlayerChromeConfig;
  theme: ThemeId;
  onTimeFormat: (v: TimeFormat) => void;
  onVolumeStyle: (v: VolumeStyle) => void;
};

export function OptionsSection({ config, theme, onTimeFormat, onVolumeStyle }: Props) {
  const t = useT();
  const { TIME_OPTIONS, VOLUME_OPTIONS } = getOptions(t);
  const timeValue = config.options.timeFormat;
  const volumeValue = config.options.volumeStyle;
  const timeSub = TIME_OPTIONS.find((o) => o.id === timeValue)?.sub ?? "";
  const volumeSub = VOLUME_OPTIONS.find((o) => o.id === volumeValue)?.sub ?? "";

  return (
    <>
      <SettingRow
        wide
        icon={<Clock3 size={18} strokeWidth={1.9} />}
        label={t("Time format")}
        desc={timeSub}
        tip={t("The two clock labels are ordinary controls. Move or hide either of them in the layout editor.")}
      >
        <div className="flex w-full flex-col gap-3">
          <TimeFormatPreview theme={theme} value={timeValue} />
          <Segmented
            value={timeValue}
            options={TIME_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
            onChange={onTimeFormat}
          />
        </div>
      </SettingRow>

      <SettingRow
        wide
        icon={<Volume2 size={18} strokeWidth={1.9} />}
        label={t("Volume control")}
        desc={volumeSub}
        tip={t("How the volume widget behaves on click and hover.")}
      >
        <Segmented
          value={volumeValue}
          options={VOLUME_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
          onChange={onVolumeStyle}
        />
      </SettingRow>
    </>
  );
}

const ELAPSED = "23:32";
const TOTAL = "1:47:00";
const REMAINING = "-1:23:28";

function TimeFormatPreview({ theme, value }: { theme: ThemeId; value: TimeFormat }) {
  if (theme === "stremio") {
    const combined =
      value === "elapsed-only"
        ? ELAPSED
        : `${ELAPSED} / ${value === "remaining" ? REMAINING : TOTAL}`;
    return (
      <PreviewShell>
        <span className="shrink-0 text-[15.5px] font-semibold tabular-nums text-ink">{combined}</span>
        <Track />
      </PreviewShell>
    );
  }
  const end = value === "remaining" ? REMAINING : value === "start-end" ? TOTAL : null;
  return (
    <PreviewShell>
      <span className="shrink-0 text-[15.5px] font-semibold tabular-nums text-ink">{ELAPSED}</span>
      <Track />
      {end && (
        <span className="shrink-0 text-[15.5px] font-semibold tabular-nums text-ink-muted">{end}</span>
      )}
    </PreviewShell>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-md bg-canvas px-4 py-3.5">{children}</div>
  );
}

function Track() {
  return (
    <span className="relative h-1 min-w-0 flex-1 rounded-full bg-edge">
      <span className="absolute inset-y-0 start-0 w-[22%] rounded-full bg-ink" />
      <span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-ink"
        style={{ insetInlineStart: "22%", marginInlineStart: "-5px" }}
      />
    </span>
  );
}
