import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useCountUp } from "./use-count-up";

type ScoreSize = "hero" | "featured" | "dense";

const NUM_CLASS: Record<ScoreSize, string> = {
  hero: "text-[clamp(40px,4vw,60px)]",
  featured: "text-[34px]",
  dense: "text-[26px]",
};

export function PersonScore({
  score,
  topScore,
  avgRating,
  ratedTitles,
  size,
  align = "end",
}: {
  score: number;
  topScore: number | null;
  avgRating: number | null;
  ratedTitles: number;
  size: ScoreSize;
  align?: "start" | "end";
}) {
  const t = useT();
  const shown = useCountUp(Math.round(score));
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = topScore && topScore > 0 ? Math.min(100, (score / topScore) * 100) : 100;
  const showBar = size === "featured";
  const items = align === "start" ? "items-start" : "items-end";

  return (
    <div className={`flex flex-col gap-1.5 ${items}`}>
      <div className={`flex flex-col ${items}`}>
        <span
          className={`font-display font-medium leading-none tabular-nums text-ink ${NUM_CLASS[size]}`}
        >
          {Math.round(shown)}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
          {t("SCORE")}
        </span>
      </div>
      {showBar && (
        <span
          aria-hidden
          className="h-1 w-[92px] overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft"
        >
          <span
            className="block h-full rounded-full bg-ink/60 transition-[width] duration-400 ease-out motion-reduce:transition-none"
            style={{ width: grown ? `${pct}%` : "0%" }}
          />
        </span>
      )}
      {avgRating !== null && (
        <span className="text-[11px] tabular-nums text-ink-subtle">
          {t("{avg} avg · {n} rated", { avg: avgRating.toFixed(1), n: String(ratedTitles) })}
        </span>
      )}
    </div>
  );
}
