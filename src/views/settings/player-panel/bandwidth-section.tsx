import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SpeedTestButton } from "./speed-test";

const BANDWIDTH_PRESETS = [0, 25, 50, 100, 300, 500, 1000] as const;

export function BandwidthInput() {
  const { settings, update } = useSettings();
  const t = useT();
  const cap = settings.bandwidthMbps;
  const summary =
    cap === 0
      ? t("No filter. All bitrates considered equally.")
      : t("Streams over {cap} Mbps will rank lower, even when cached.", { cap });
  return (
    <div
      id="set-internet-speed"
      className="scroll-mt-28 flex flex-col gap-4 rounded-md bg-canvas p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-medium text-ink">{t("Internet speed")}</span>
          <span className="text-[12.5px] text-ink-subtle">
            {t("Pick the cap your link can sustain. Run a real speed test if you need a number.")}
          </span>
        </div>
        <SpeedTestButton />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BANDWIDTH_PRESETS.map((value) => {
          const selected = cap === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => update({ bandwidthMbps: value })}
              className={`flex h-9 items-center rounded-md border px-3 text-[12.5px] font-semibold tabular-nums transition ${
                selected
                  ? "border-ink bg-ink text-canvas"
                  : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
              }`}
            >
              {value === 0 ? t("No limit") : value === 1000 ? "1 Gbps" : `${value} Mbps`}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[11.5px] text-ink-muted">{summary}</span>
      </div>
    </div>
  );
}
