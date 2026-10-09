import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useT } from "@/lib/i18n";

const CELLS = 14;
const DECAY = 0.045;
const BANDS = [0, 1, 2, 3, 4, 5, 6, 7];
const DEFAULT_RAMP = ["rgb(37 224 160)", "rgb(255 176 46)", "rgb(255 75 62)"];

const STAGGER = 52;
const RISE_TAU = 105;
const FALL_TAU = 165;
const SWEEP_PEAK = 175;
const SWEEP_GAIN = 0.34;
const SWEEP_END = 1600;

const GLYPH_ROWS = 7;
const GLYPH_COLS = 5;
const GLYPHS: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
};
const WORD = "LOADING";
const WORD_COLS = WORD.length * GLYPH_COLS + WORD.length - 1;
const DOT_GAP = 3;
const DOT_STEP = 4;
const DOT_COUNT = 3;
const MATRIX_COLS = WORD_COLS + DOT_GAP + (DOT_COUNT - 1) * DOT_STEP + 2;
const DOT_MS = 330;

function wordPath(): string {
  const strokes: string[] = [];
  for (let index = 0; index < WORD.length; index += 1) {
    const glyph = GLYPHS[WORD[index]];
    const origin = index * (GLYPH_COLS + 1);
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      for (let col = 0; col < GLYPH_COLS; col += 1) {
        if (glyph[row][col] !== "1") continue;
        strokes.push(`M${origin + col} ${row}h.62v.62h-.62Z`);
      }
    }
  }
  return strokes.join("");
}

const WORD_PATH = wordPath();
const MATRIX_VARS = {
  "--dj-cols": String(MATRIX_COLS),
  "--dj-word": String(WORD_COLS),
  "--dj-mrow": String(GLYPH_ROWS),
  "--dj-dgap": String(DOT_GAP),
  "--dj-dstep": String(DOT_STEP),
} as CSSProperties;
const DOT_VARS = [0, 1, 2].map((index) => ({ "--dj-i": String(index) }) as CSSProperties);

function channels(color: string): number[] {
  const found = color.match(/-?\d+(\.\d+)?/g);
  return found && found.length >= 3 ? found.slice(0, 3).map(Number) : [255, 255, 255];
}

function buildRamp(palette: string[], height: number): string[] {
  const stops = (palette.length >= 2 ? palette : DEFAULT_RAMP).map(channels);
  const last = stops.length - 1;
  return Array.from({ length: height }, (_, row) => {
    const at = (row / Math.max(1, height - 1)) * last;
    const low = Math.min(last, Math.floor(at));
    const high = Math.min(last, low + 1);
    const blend = at - low;
    const mixed = stops[low].map((value, channel) =>
      Math.round(value + (stops[high][channel] - value) * blend),
    );
    return `rgb(${mixed.join(" ")})`;
  });
}

export function Lcd({
  spectrum,
  playing,
  loading,
  rows,
  palette,
}: {
  spectrum?: number[];
  playing: boolean;
  loading?: boolean;
  rows?: number;
  palette?: string[];
}) {
  const t = useT();
  const height = rows ?? CELLS;
  const ramp = useMemo(() => buildRamp(palette ?? [], height), [palette, height]);
  const shell = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLSpanElement | null>(null);
  const columns = useRef<(HTMLSpanElement | null)[]>([]);
  const peaks = useRef<number[]>(Array(8).fill(0));
  const levels = useRef<number[]>(Array(8).fill(0));
  const gains = useRef<number[]>(Array(8).fill(0));
  const wake = useRef({ at: 0, up: false });
  const resolving = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const db = spectrum && spectrum.length === 8 ? spectrum : null;
    if (!db) return;
    levels.current = BANDS.map((band) => Math.max(0, Math.min(1, (db[band] + 62) / 62)));
  }, [spectrum, playing]);

  useEffect(() => {
    wake.current = { at: performance.now(), up: playing };
  }, [playing]);

  useEffect(() => {
    resolving.current = loading === true;
    if (loading) startedAt.current = performance.now();
  }, [loading]);

  useEffect(() => {
    const node = shell.current;
    if (!node) return;
    const fit = () => {
      const box = node.getBoundingClientRect();
      if (box.width <= 0) return;
      const wide = (box.width - 34) / MATRIX_COLS;
      const tall = (box.height - 30) / (GLYPH_ROWS + 4);
      node.style.setProperty(
        "--dj-pitch",
        `${Math.max(2.4, Math.min(9, Math.min(wide, tall))).toFixed(2)}px`,
      );
    };
    fit();
    const watcher = new ResizeObserver(fit);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    let last = performance.now();
    const step = (now: number) => {
      if (!alive) return;
      const delta = Math.min(64, Math.max(1, now - last));
      last = now;
      const elapsed = now - wake.current.at;
      const up = wake.current.up;
      for (const band of BANDS) {
        const open = elapsed - band * STAGGER;
        if (open > 0) {
          const blend = 1 - Math.exp(-Math.min(open, delta) / (up ? RISE_TAU : FALL_TAU));
          gains.current[band] += ((up ? 1 : 0) - gains.current[band]) * blend;
        }
        const swept =
          up && open > 0 && open < SWEEP_END
            ? SWEEP_GAIN * (open / SWEEP_PEAK) * Math.exp(1 - open / SWEEP_PEAK)
            : 0;
        const level = Math.max(
          0,
          Math.min(1, (levels.current[band] + swept) * gains.current[band]),
        );
        const peak = Math.max(level, peaks.current[band] - DECAY);
        peaks.current[band] = peak;
        const node = columns.current[band];
        if (!node) continue;
        const lit = Math.round(level * height);
        node.style.setProperty("--dj-lit", String(lit));
        node.style.setProperty("--dj-peak", String(Math.round(peak * height)));
        node.style.setProperty("--dj-top", ramp[Math.max(0, lit - 1)] ?? ramp[0]);
      }
      const panel = board.current;
      if (resolving.current && panel) {
        const beat = ((now - startedAt.current) / DOT_MS) % (DOT_COUNT + 1);
        panel.style.setProperty("--dj-dots", beat.toFixed(3));
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [height, ramp]);

  const gradient = useMemo(
    () =>
      ramp
        .map((color, row) => {
          const from = (row / height) * 100;
          const to = ((row + 1) / height) * 100;
          return `${color} ${from}% ${to}%`;
        })
        .join(", "),
    [ramp, height],
  );

  return (
    <>
      <span className="sr-only" role="status">
        {loading ? t("dj.loading") : ""}
      </span>
      <div
        ref={shell}
        className="dj-lcd"
        data-live={playing || undefined}
        data-load={loading || undefined}
        aria-hidden="true"
        style={{ ["--dj-rows" as string]: String(height) }}
      >
        <span className="dj-lcd-glass" />
        {BANDS.map((band) => (
          <span
            key={band}
            ref={(node) => {
              columns.current[band] = node;
            }}
            className="dj-lcd-col"
            style={{ ["--dj-ramp" as string]: `linear-gradient(to top, ${gradient})` }}
          >
            <i className="dj-lcd-fill" />
            <i className="dj-lcd-cap" />
          </span>
        ))}
        <span ref={board} className="dj-lcd-load" style={MATRIX_VARS}>
          <span className="dj-lcd-matrix">
            <i className="dj-lcd-field" />
            <svg
              className="dj-lcd-word"
              viewBox={`0 0 ${WORD_COLS} ${GLYPH_ROWS}`}
              focusable="false"
            >
              <path d={WORD_PATH} />
            </svg>
            {DOT_VARS.map((vars, index) => (
              <i key={index} className="dj-lcd-dot" style={vars} />
            ))}
          </span>
        </span>
      </div>
    </>
  );
}
