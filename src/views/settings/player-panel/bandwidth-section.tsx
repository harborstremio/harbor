import { useSettings } from "@/lib/settings";

import { SpeedTestButton } from "./speed-test";

const BANDWIDTH_PRESETS: Array<{ value: number; label: string }> = [
  { value: 0, label: "No limit" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 300, label: "300" },
  { value: 500, label: "500" },
  { value: 1000, label: "1 Gbps" },
];

export function BandwidthInput() {
  const { settings, update } = useSettings();
  const cap = settings.bandwidthMbps;
  const summary =
    cap === 0
      ? "No filter. All bitrates considered equally."
      : `Streams over ${cap} Mbps will rank lower, even when cached.`;
  return (
    <div
      id="set-internet-speed"
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">Internet speed</span>
          <span className="text-[12.5px] text-ink-subtle">
            Pick the cap your link can sustain. Run a real speed test if you need a number.
          </span>
        </div>
        <SpeedTestButton />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BANDWIDTH_PRESETS.map((p) => {
          const selected = cap === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => update({ bandwidthMbps: p.value })}
              className={`flex h-9 items-center rounded-lg border px-3 text-[12.5px] font-semibold tabular-nums transition-all ${
                selected
                  ? "border-ink bg-ink text-canvas"
                  : "border-edge-soft bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
              }`}
            >
              {p.value === 0 ? p.label : p.value === 1000 ? p.label : `${p.label} Mbps`}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,200,140,0.5)]" />
        <span className="text-[11.5px] text-ink-muted">{summary}</span>
      </div>
    </div>
  );
}
