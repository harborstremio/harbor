import { useT } from "@/lib/i18n";
import type { PlayerChromeConfig, TimeFormat, VolumeStyle } from "@/lib/player-chrome";

export function getOptions(t: (k: string) => string) {
  const TIME_OPTIONS: Array<{ id: TimeFormat; label: string; sub: string }> = [
    { id: "start-end", label: t("Elapsed and remaining"), sub: t("00:23 on the left, -1:12 on the right.") },
    { id: "remaining", label: t("Remaining only"), sub: t("Single -1:12 label, both ends collapse.") },
    { id: "elapsed-only", label: t("Elapsed only"), sub: t("Single 00:23 label, both ends collapse.") },
  ];

  const VOLUME_OPTIONS: Array<{ id: VolumeStyle; label: string; sub: string }> = [
    { id: "slider", label: t("Slider"), sub: t("Hover the speaker to reveal a horizontal slider.") },
    { id: "stepper", label: t("Stepper"), sub: t("Click to cycle 100 / 75 / 50 / 25 / 0.") },
    { id: "icon-only", label: t("Icon only"), sub: t("Click toggles mute. Wheel scrolls volume.") },
  ];
  return { TIME_OPTIONS, VOLUME_OPTIONS };
}

type Props = {
  config: PlayerChromeConfig;
  onTimeFormat: (v: TimeFormat) => void;
  onVolumeStyle: (v: VolumeStyle) => void;
};

export function OptionsSection({ config, onTimeFormat, onVolumeStyle }: Props) {
  const t = useT();
  const { TIME_OPTIONS, VOLUME_OPTIONS } = getOptions(t);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <OptionCard
        title={t("Time format")}
        sub={t("What the clock labels show on the seek bar.")}
        value={config.options.timeFormat}
        options={TIME_OPTIONS}
        onChange={onTimeFormat}
      />
      <OptionCard
        title={t("Volume control")}
        sub={t("How the volume widget behaves on click and hover.")}
        value={config.options.volumeStyle}
        options={VOLUME_OPTIONS}
        onChange={onVolumeStyle}
      />
    </div>
  );
}

function OptionCard<T extends string>({
  title,
  sub,
  value,
  options,
  onChange,
}: {
  title: string;
  sub: string;
  value: T;
  options: Array<{ id: T; label: string; sub: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge-soft bg-elevated/40 p-5">
      <div className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{title}</span>
        <p className="text-[12px] text-ink-muted">{sub}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-colors ${
                selected ? "border-ink bg-elevated" : "border-edge-soft bg-canvas/40 hover:border-edge"
              }`}
            >
              <span
                className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected ? "border-ink" : "border-edge"
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-ink">{opt.label}</span>
                <span className="text-[11.5px] leading-snug text-ink-subtle">{opt.sub}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
