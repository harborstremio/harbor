import {
  useCallback,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MUSIC_EQ_FREQUENCIES } from "@/lib/music/audio-settings";
import { useT } from "@/lib/i18n";

const VBW = 1000;
const VBH = 340;
const PAD_L = 46;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 40;
const PLOT_W = VBW - PAD_L - PAD_R;
const PLOT_H = VBH - PAD_T - PAD_B;
const MID_Y = PAD_T + PLOT_H / 2;
const RANGE = 12;

const clamp = (value: number) => Math.max(-RANGE, Math.min(RANGE, value));
const bandX = (index: number) => PAD_L + (PLOT_W * index) / (MUSIC_EQ_FREQUENCIES.length - 1);
const gainToY = (gain: number) => MID_Y - (gain / RANGE) * (PLOT_H / 2);
const freqLabel = (frequency: number) =>
  frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`;

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function MusicEqCurve({
  bands,
  disabled,
  onChange,
}: {
  bands: number[];
  disabled?: boolean;
  onChange: (bands: number[]) => void;
}) {
  const t = useT();
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeBand = useRef<number | null>(null);

  const points = MUSIC_EQ_FREQUENCIES.map((_, index) => ({
    x: bandX(index),
    y: gainToY(bands[index] ?? 0),
  }));
  const line = smoothPath(points);
  const fill = line
    ? `${line} L ${bandX(MUSIC_EQ_FREQUENCIES.length - 1).toFixed(2)} ${(PAD_T + PLOT_H).toFixed(2)} L ${PAD_L.toFixed(2)} ${(PAD_T + PLOT_H).toFixed(2)} Z`
    : "";

  const setBand = useCallback(
    (index: number, gain: number) => {
      const next = clamp(Math.round(gain * 2) / 2);
      if ((bands[index] ?? 0) === next) return;
      onChange(MUSIC_EQ_FREQUENCIES.map((_, i) => (i === index ? next : (bands[i] ?? 0))));
    },
    [bands, onChange],
  );

  const pointerGain = useCallback((clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const vbY = ((clientY - rect.top) / rect.height) * VBH;
    return clamp(((MID_Y - vbY) / (PLOT_H / 2)) * RANGE);
  }, []);

  const nearestBand = useCallback((clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const vbX = ((clientX - rect.left) / rect.width) * VBW;
    let index = 0;
    let best = Infinity;
    MUSIC_EQ_FREQUENCIES.forEach((_, i) => {
      const distance = Math.abs(bandX(i) - vbX);
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    return index;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (disabled || event.button !== 0) return;
      const index = nearestBand(event.clientX);
      activeBand.current = index;
      event.currentTarget.setPointerCapture(event.pointerId);
      setBand(index, pointerGain(event.clientY));
    },
    [disabled, nearestBand, pointerGain, setBand],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (activeBand.current === null) return;
      setBand(activeBand.current, pointerGain(event.clientY));
    },
    [pointerGain, setBand],
  );

  const release = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeBand.current === null) return;
    activeBand.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  const onHandleKey = useCallback(
    (event: ReactKeyboardEvent<SVGCircleElement>, index: number) => {
      const step = event.shiftKey ? 1 : 0.5;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        setBand(index, (bands[index] ?? 0) + step);
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        setBand(index, (bands[index] ?? 0) - step);
      } else if (event.key === "Home") {
        event.preventDefault();
        setBand(index, RANGE);
      } else if (event.key === "End") {
        event.preventDefault();
        setBand(index, -RANGE);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setBand(index, 0);
      }
    },
    [bands, setBand],
  );

  return (
    <div className={`music-eq-curve${disabled ? " is-disabled" : ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VBW} ${VBH}`}
        role="group"
        aria-label={t("music.audio.eqCurve")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[RANGE, RANGE / 2, 0, -RANGE / 2, -RANGE].map((db) => (
          <g key={db}>
            <line
              x1={PAD_L}
              x2={VBW - PAD_R}
              y1={gainToY(db)}
              y2={gainToY(db)}
              className={db === 0 ? "music-eq-grid music-eq-grid-zero" : "music-eq-grid"}
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD_L - 10} y={gainToY(db) + 4} textAnchor="end" className="music-eq-axis">
              {db > 0 ? `+${db}` : db}
            </text>
          </g>
        ))}
        {fill && <path d={fill} fill={`url(#${gradientId})`} stroke="none" />}
        {line && (
          <path d={line} className="music-eq-line" fill="none" vectorEffect="non-scaling-stroke" />
        )}
        {MUSIC_EQ_FREQUENCIES.map((frequency, index) => (
          <text
            key={`f${frequency}`}
            x={bandX(index)}
            y={VBH - 12}
            textAnchor="middle"
            className="music-eq-axis"
          >
            {freqLabel(frequency)}
          </text>
        ))}
        {MUSIC_EQ_FREQUENCIES.map((frequency, index) => (
          <circle
            key={`h${frequency}`}
            cx={points[index].x}
            cy={points[index].y}
            r={9}
            className="music-eq-handle"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={t("music.audio.band", { frequency })}
            aria-valuemin={-RANGE}
            aria-valuemax={RANGE}
            aria-valuenow={bands[index] ?? 0}
            aria-valuetext={`${(bands[index] ?? 0) > 0 ? "+" : ""}${bands[index] ?? 0} dB`}
            aria-disabled={disabled || undefined}
            onKeyDown={(event) => onHandleKey(event, index)}
          />
        ))}
      </svg>
    </div>
  );
}
