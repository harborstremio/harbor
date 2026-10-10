import { useMemo } from "react";
import { AwardTab } from "./award-tab";
import { AwardLogo } from "./icons/award-logo";
import { awardSummary, useAwards } from "@/lib/providers/wikidata";
import { mergeBundledAwards } from "@/lib/awards-history";
import { parseAwardYear } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";

const NOUN: Record<string, string> = {
  oscar: "Oscar",
  emmy: "Emmy",
  golden_globe: "Globe",
  bafta: "BAFTA",
  bafta_tv: "BAFTA",
  sag: "SAG",
  critics_choice: "Critics",
  cannes: "Cannes",
  venice: "Venice",
  berlin: "Berlin",
  annie: "Annie",
  spirit: "Spirit",
  saturn: "Saturn",
  cesar: "Cesar",
  goya: "Goya",
  blue_dragon: "Blue Dragon",
  baeksang: "Baeksang",
  bifa: "BIFA",
};

export type ClassicWin = { type: string; wins: number };

function labelFor(win: ClassicWin): string {
  const noun = NOUN[win.type] ?? "Award";
  if (win.wins > 1) return `${win.wins} ${noun.endsWith("s") ? noun : `${noun}s`}`;
  return noun;
}

export function useClassicAwardWin(meta: Meta, imdbId?: string): ClassicWin | null {
  const live = useAwards(imdbId, meta.type === "series");
  const year = parseAwardYear(meta.releaseInfo);
  return useMemo(() => {
    const summary = awardSummary(mergeBundledAwards(live, meta.name, year));
    const won = summary.find((s) => s.wins > 0);
    return won ? { type: won.type, wins: won.wins } : null;
  }, [live, meta.name, year]);
}

export function ClassicAwardTab({
  win,
  below,
  top,
}: {
  win: ClassicWin | null;
  below?: boolean;
  top?: boolean;
}) {
  if (!win) return null;
  return (
    <span
      className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${
        top ? "top-1.5" : below ? "bottom-1.5" : "bottom-7"
      }`}
    >
      <AwardTab label={labelFor(win)} />
    </span>
  );
}

export function ClassicAwardBadge({
  win,
  dubShift = false,
  stacked = false,
}: {
  win: ClassicWin | null;
  dubShift?: boolean;
  stacked?: boolean;
}) {
  if (!win) return null;
  const above = (dubShift ? 1 : 0) + (stacked ? 1 : 0);
  const topClass = above >= 2 ? "top-[56px]" : above === 1 ? "top-[34px]" : "top-2";
  return (
    <span
      className={`pointer-events-none absolute start-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink ring-1 ring-edge-soft/60 ${topClass}`}
    >
      <AwardLogo type={win.type} size={11} />
      <span className="truncate">{labelFor(win)}</span>
    </span>
  );
}
