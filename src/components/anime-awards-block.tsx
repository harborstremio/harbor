import {
  awardSourceMeta,
  findAnyAwardWins,
  groupWinsBySource,
  type AwardSourceId,
  type AwardWin,
} from "@/lib/anime-awards";
import { useView } from "@/lib/view";
import { ArrowUpRight } from "lucide-react";

export function AnimeAwardsBlock({ name, year }: { name: string; year?: number }) {
  const wins = findAnyAwardWins(name, year);
  if (wins.length === 0) return null;
  const groups = groupWinsBySource(name, year);
  const totalWins = wins.length;

  return (
    <div id="anime-awards-section" className="scroll-mt-24 border-t border-edge-soft pt-14">
      <div className="mb-10 flex items-baseline justify-between gap-4">
        <h3 className="text-[24px] font-medium tracking-tight text-ink">Anime Awards & Recognition</h3>
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          <span className="text-accent">{totalWins}</span> {totalWins === 1 ? "Win" : "Wins"} · {groups.length}{" "}
          {groups.length === 1 ? "ceremony" : "ceremonies"}
        </span>
      </div>
      <div className="flex flex-col gap-14">
        {groups.map((g) => (
          <SourceGroup key={g.source} source={g.source} wins={g.wins} />
        ))}
      </div>
    </div>
  );
}

function SourceGroup({ source, wins }: { source: AwardSourceId; wins: AwardWin[] }) {
  const { openAnimeAward } = useView();
  const meta = awardSourceMeta(source);
  const years = uniqueYears(wins);
  const logoClass = `h-auto max-h-12 w-auto max-w-[180px] shrink-0 ${
    source === "taaf" || source === "crunchyroll" ? "invert hue-rotate-180" : ""
  } ${source === "animation_kobe" ? "brightness-0 invert max-h-14" : ""}`;
  return (
    <section className="grid gap-7 lg:grid-cols-[240px_1fr] lg:gap-14">
      <header className="flex flex-row items-center gap-5 lg:flex-col lg:items-start lg:gap-5">
        <button
          type="button"
          onClick={() => openAnimeAward(source)}
          className="shrink-0 rounded-md transition-opacity hover:opacity-80"
          aria-label={`Open ${meta.name} winners`}
        >
          <img src={meta.icon} alt={meta.name} className={logoClass} draggable={false} />
        </button>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => openAnimeAward(source)}
            className="group flex items-center gap-1.5 text-start text-[18px] font-medium tracking-tight text-ink transition-colors hover:text-accent"
          >
            {meta.name}
            <ArrowUpRight
              size={14}
              strokeWidth={2.4}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            <span className="text-accent">{wins.length}</span> {wins.length === 1 ? "Win" : "Wins"}
          </p>
          {years.length > 0 && (
            <p className="mt-1 text-[11px] font-medium tabular-nums text-ink-subtle/80">{formatYearSpan(years)}</p>
          )}
          <button
            type="button"
            onClick={() => openAnimeAward(source)}
            className="mt-1 w-fit text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-opacity hover:opacity-80"
          >
            See all winners →
          </button>
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-5">
        <ul className="grid grid-cols-1 gap-x-10 gap-y-0 xl:grid-cols-2">
          {wins.map((w, i) => (
            <WinRow key={`${w.year}-${w.categoryKey}-${i}`} win={w} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function WinRow({ win }: { win: AwardWin }) {
  return (
    <li className="flex items-baseline gap-4 border-b border-edge-soft/30 py-2.5 text-[13px]">
      <span className="w-11 shrink-0 font-semibold tabular-nums text-accent">{win.year}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium leading-tight text-ink">
          {win.isAOTY ? "Anime of the Year" : win.categoryName.replace(/^Best\s+/i, "Best ")}
        </span>
        <span className="truncate text-[12px] leading-tight text-ink-subtle" title={win.title}>
          {win.title}
        </span>
      </div>
    </li>
  );
}

function uniqueYears(wins: AwardWin[]): number[] {
  const set = new Set<number>();
  for (const w of wins) set.add(w.year);
  return [...set].sort((a, b) => a - b);
}

function formatYearSpan(years: number[]): string {
  if (years.length === 0) return "";
  if (years.length === 1) return String(years[0]);
  const first = years[0];
  const last = years[years.length - 1];
  if (first === last) return String(first);
  return `${first}–${last}`;
}
