import { useT } from "@/lib/i18n";
import {
  CHANNEL_COL_PX,
  PX_PER_MIN,
  ROW_HEIGHT_PX,
  RULER_HEIGHT_PX,
  WINDOW_HOURS,
  WINDOW_PX,
  CARD_GAP_X,
  CARD_GAP_Y,
} from "./guide/guide-utils";

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="h-[160px] animate-pulse rounded-2xl border border-edge-soft/40 bg-elevated/50"
          style={{ animationDelay: `${(i % 6) * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function GuideSkeleton() {
  const t = useT();
  const rows = 10;
  const slotMin = 30;
  const slots = Math.ceil((WINDOW_HOURS * 60) / slotMin);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative overflow-hidden">
        <div
          className="relative"
          style={{
            width: CHANNEL_COL_PX + WINDOW_PX,
            minHeight: RULER_HEIGHT_PX + rows * ROW_HEIGHT_PX,
          }}
        >
          <div className="flex bg-canvas">
            <div
              className="flex shrink-0 items-center gap-2 border-b border-e border-edge-soft/60 px-3"
              style={{ width: CHANNEL_COL_PX, height: RULER_HEIGHT_PX }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
                {t("Channel")}
              </span>
            </div>
            <div
              className="flex border-b border-edge-soft/60"
              style={{ height: RULER_HEIGHT_PX }}
            >
              {Array.from({ length: slots }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex shrink-0 items-center ps-2.5"
                  style={{ width: slotMin * PX_PER_MIN }}
                >
                  <div
                    className="h-3 w-12 animate-pulse rounded bg-elevated/60"
                    style={{ animationDelay: `${i * 70}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="relative flex border-b border-edge-soft/30"
              style={{ height: ROW_HEIGHT_PX }}
            >
              <div
                className="flex shrink-0 items-center gap-3 border-e border-edge-soft/40 px-3"
                style={{ width: CHANNEL_COL_PX }}
              >
                <div
                  className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-elevated/60"
                  style={{ animationDelay: `${r * 110}ms` }}
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div
                    className="h-3 w-3/4 animate-pulse rounded bg-elevated/55"
                    style={{ animationDelay: `${r * 110 + 40}ms` }}
                  />
                  <div
                    className="h-2 w-1/2 animate-pulse rounded bg-elevated/40"
                    style={{ animationDelay: `${r * 110 + 80}ms` }}
                  />
                </div>
              </div>
              <ProgramBlocksRow seed={r} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProgramBlocksRow({ seed }: { seed: number }) {
  const base = ROW_WIDTHS[seed % ROW_WIDTHS.length];
  const widths: number[] = [];
  for (let total = 0, i = 0; total < WINDOW_PX; i += 1) {
    const w = base[i % base.length];
    widths.push(w);
    total += w + CARD_GAP_X;
  }
  let x = 0;
  return (
    <div className="relative flex h-full" style={{ width: WINDOW_PX }}>
      {widths.map((w, i) => {
        const left = x;
        x += w + CARD_GAP_X;
        return (
          <div
            key={i}
            className="absolute top-0 animate-pulse bg-elevated/50"
            style={{
              left,
              width: w,
              bottom: CARD_GAP_Y,
              animationDelay: `${seed * 80 + i * 60}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

const ROW_WIDTHS: number[][] = [
  [180, 90, 180, 60, 150, 120],
  [90, 180, 90, 240, 90, 120],
  [240, 60, 120, 180, 90, 150],
  [120, 150, 180, 90, 120, 180],
  [60, 240, 90, 150, 180, 90],
  [150, 90, 120, 240, 60, 180],
];

const MV_LAYOUTS: Record<"1" | "2" | "3" | "2x2", string> = {
  "1": "grid-cols-1 grid-rows-1",
  "2": "grid-cols-2 grid-rows-1",
  "3": "grid-cols-3 grid-rows-1",
  "2x2": "grid-cols-2 grid-rows-2",
};

const MV_COUNT: Record<"1" | "2" | "3" | "2x2", number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "2x2": 4,
};

export function MultiviewSkeleton({ layout = "2x2" }: { layout?: "1" | "2" | "3" | "2x2" }) {
  const count = MV_COUNT[layout];
  return (
    <div className={`grid h-full w-full gap-2 ${MV_LAYOUTS[layout]}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-edge-soft/40 bg-elevated/40"
        >
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-elevated/20 via-elevated/40 to-elevated/20"
            style={{ animationDelay: `${i * 140}ms` }}
          />
          <div className="relative z-10 flex flex-col items-center gap-2.5">
            <div className="h-10 w-10 animate-pulse rounded-full bg-elevated/70" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-elevated/60" />
            <div className="h-2 w-16 animate-pulse rounded bg-elevated/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
