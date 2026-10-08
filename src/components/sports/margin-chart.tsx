import { useId, useState, type PointerEvent } from "react";
import { useT } from "@/lib/i18n";

type Point = { minute: number; margin: number };

/**
 * Momentum through a game, home-positive around a zero baseline: the score margin (US sports)
 * or attack pressure (soccer). Above the line = home on top (accent fill), below = away (muted).
 * The labels name the sides so colour is never the only cue. Pointer hover shows a minute; the
 * chart is not focusable, so arrow keys keep moving TV focus around the page.
 */
export function MarginChart({
  points,
  home,
  away,
  mode,
  periods,
  prefix,
}: {
  points: Point[];
  home: string;
  away: string;
  mode: "margin" | "pressure";
  periods: number;
  prefix: string;
}) {
  const t = useT();
  const clip = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 960;
  const H = 240;
  const PAD = { l: 44, r: 16, t: 16, b: periods ? 28 : 12 };
  const maxMin = Math.max(...points.map((p) => p.minute), 1);
  const peak = Math.max(mode === "margin" ? 7 : 20, ...points.map((p) => Math.abs(p.margin)));
  const x = (m: number) => PAD.l + ((W - PAD.l - PAD.r) * m) / maxMin;
  const y = (v: number) => PAD.t + ((H - PAD.t - PAD.b) / 2) * (1 - v / peak);
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)},${y(p.margin).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(points[points.length - 1].minute).toFixed(1)},${y(0)}L${x(points[0].minute).toFixed(1)},${y(0)}Z`;
  const span = periods ? maxMin / periods : 0;
  const h = hover != null ? points[hover] : null;
  const biggest = points.reduce(
    (a, p) => (Math.abs(p.margin) > Math.abs(a.margin) ? p : a),
    points[0],
  );
  const describe = (v: number) =>
    mode === "pressure"
      ? v > 0
        ? t("{team} pressing", { team: home })
        : v < 0
          ? t("{team} pressing", { team: away })
          : t("Even")
      : v > 0
        ? `${home} +${v}`
        : v < 0
          ? `${away} +${-v}`
          : t("Tied");
  const summary =
    mode === "margin"
      ? t("Biggest lead: {lead} (minute {minute})", {
          lead: describe(biggest.margin),
          minute: biggest.minute,
        })
      : t("Strongest spell: {lead} (minute {minute})", {
          lead: describe(biggest.margin),
          minute: biggest.minute,
        });

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = ((((e.clientX - r.left) / r.width) * W - PAD.l) / (W - PAD.l - PAD.r)) * maxMin;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.minute - m) < Math.abs(points[best].minute - m)) best = i;
    });
    setHover(best);
  };

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-[13px] text-ink-muted">
        <span>▲ {mode === "margin" ? t("{team} ahead", { team: home }) : home}</span>
        <span className="text-ink">
          {h ? `${t("Minute {minute}", { minute: h.minute })}: ${describe(h.margin)}` : summary}
        </span>
        <span>▼ {mode === "margin" ? t("{team} ahead", { team: away }) : away}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none text-ink"
        role="img"
        aria-label={`${summary}. ${t("Final")}: ${describe(points[points.length - 1].margin)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={`${clip}-up`}>
            <rect x="0" y="0" width={W} height={y(0)} />
          </clipPath>
          <clipPath id={`${clip}-down`}>
            <rect x="0" y={y(0)} width={W} height={H - y(0)} />
          </clipPath>
        </defs>
        {[peak, 0, -peak].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              strokeOpacity={v === 0 ? 0.35 : 0.1}
            />
            {mode === "margin" && (
              <text
                x={PAD.l - 8}
                y={y(v) + 4}
                textAnchor="end"
                fill="var(--color-ink-subtle)"
                fontSize="12"
              >
                {v > 0 ? `+${Math.round(v)}` : Math.round(v)}
              </text>
            )}
          </g>
        ))}
        {Array.from({ length: Math.max(0, periods - 1) }, (_, i) => i + 1).map((q) => (
          <line
            key={q}
            x1={x(q * span)}
            x2={x(q * span)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="currentColor"
            strokeOpacity={0.08}
          />
        ))}
        {Array.from({ length: periods }, (_, q) => (
          <text
            key={q}
            x={x(q * span + span / 2)}
            y={H - 8}
            textAnchor="middle"
            fill="var(--color-ink-subtle)"
            fontSize="12"
          >
            {`${prefix}${q + 1}`}
          </text>
        ))}
        <path d={area} fill="var(--color-accent)" fillOpacity={0.4} clipPath={`url(#${clip}-up)`} />
        <path
          d={area}
          fill="var(--color-ink-muted)"
          fillOpacity={0.3}
          clipPath={`url(#${clip}-down)`}
        />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        {h && (
          <g>
            <line
              x1={x(h.minute)}
              x2={x(h.minute)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="currentColor"
              strokeOpacity={0.4}
            />
            <circle
              cx={x(h.minute)}
              cy={y(h.margin)}
              r={5}
              fill="currentColor"
              stroke="var(--color-canvas)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
    </figure>
  );
}
