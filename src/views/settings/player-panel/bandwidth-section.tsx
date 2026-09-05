import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Anchored } from "./choice";
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
    <Anchored id="set-internet-speed">
      <SettingRow
        wide
        label={t("Internet speed")}
        desc={t(
          "Pick the cap your connection can sustain. Streams that need more than this rank lower, so Harbor stops offering you files you cannot actually play.",
        )}
      >
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap gap-2.5">
            {BANDWIDTH_PRESETS.map((value) => {
              const selected = cap === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ bandwidthMbps: value })}
                  aria-pressed={selected}
                  className={`flex h-11 items-center rounded-[8px] border px-4 text-[15.5px] font-semibold tabular-nums transition-colors ${
                    selected
                      ? "border-transparent bg-ink text-canvas"
                      : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
                  }`}
                >
                  {value === 0 ? t("No limit") : value === 1000 ? "1 Gbps" : `${value} Mbps`}
                </button>
              );
            })}
          </div>
          <span className="flex max-w-[66ch] items-center gap-2 text-[15.5px] leading-[22px] text-ink-muted">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            {summary}
          </span>
        </div>
      </SettingRow>
      <SettingRow
        label={t("Measure this connection")}
        desc={t(
          "Runs a short download test against Cloudflare and shows the result here, so you can pick a cap that matches your real line.",
        )}
      >
        <SpeedTestButton />
      </SettingRow>
    </Anchored>
  );
}
