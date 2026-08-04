import type { StatusSlice } from "@/lib/anilist/media-details";

const LABEL_COLORS: Record<string, string> = {
  Watching: "oklch(0.72 0.13 235)",
  Completed: "oklch(0.72 0.14 165)",
  "On Hold": "oklch(0.78 0.13 75)",
  Dropped: "oklch(0.64 0.17 20)",
  "Plan to Watch": "oklch(0.66 0.11 285)",
  Paused: "oklch(0.78 0.13 75)",
};

const FALLBACK_COLORS = [
  "oklch(0.72 0.13 235)",
  "oklch(0.72 0.14 165)",
  "oklch(0.78 0.13 75)",
  "oklch(0.64 0.17 20)",
  "oklch(0.66 0.11 285)",
  "oklch(0.7 0.1 320)",
];

function colorFor(label: string, index: number) {
  return LABEL_COLORS[label] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function formatCount(n: number) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}K`;
  }
  return String(n);
}

export function AnimeStatsDonut({ slices }: { slices: StatusSlice[] }) {
  if (slices.length === 0) return null;
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  if (total <= 0) return null;

  let offset = 0;
  const arcs = slices.map((slice, index) => {
    const pct = (slice.amount / total) * 100;
    const dashoffset = 25 - offset;
    offset += pct;
    return {
      label: slice.label,
      amount: slice.amount,
      pct,
      color: colorFor(slice.label, index),
      dasharray: `${pct} ${100 - pct}`,
      dashoffset,
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="var(--color-edge-soft)"
            strokeWidth="5"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={arc.color}
              strokeWidth="5"
              strokeDasharray={arc.dasharray}
              strokeDashoffset={arc.dashoffset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[19px] font-medium tracking-tight text-ink">
            {formatCount(total)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-subtle">members</span>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-2">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: arc.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted">
              {arc.label}
            </span>
            <span className="text-[12.5px] tabular-nums text-ink">{formatCount(arc.amount)}</span>
            <span className="w-11 text-end text-[12.5px] tabular-nums text-ink-subtle">
              {arc.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
