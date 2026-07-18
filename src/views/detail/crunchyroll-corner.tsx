import {
  awardSourceMeta,
  findAnyAwardWins,
  groupWinsBySource,
  type AwardSourceId,
} from "@/lib/anime-awards";
import { useT } from "@/lib/i18n";

const MAX_LINES = 3;

export function CrunchyrollAwardsCorner({
  name,
  year,
  inline,
}: {
  name: string;
  year?: number;
  inline?: boolean;
}) {
  const t = useT();
  const wins = findAnyAwardWins(name, year);
  if (wins.length === 0) return null;
  const groups = groupWinsBySource(name, year);
  const top = groups[0];
  const topSource = awardSourceMeta(top.source);
  const otherGroups = groups.slice(1);

  const lines: string[] = [];
  for (const w of top.wins.slice(0, MAX_LINES)) {
    lines.push(formatLine(t, w.year, w.categoryName, w.categoryKey === "anime_of_the_year"));
  }
  const overflow = top.wins.length - lines.length;

  const tooltip = wins
    .map((w) => `${awardSourceMeta(w.source).shortName} ${w.year} ${w.categoryName}`)
    .join("\n");

  return (
    <button
      type="button"
      data-hero-awards
      onClick={(e) => {
        e.stopPropagation();
        document
          .getElementById("anime-awards-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`group flex max-w-xs flex-col items-end gap-2 rounded-2xl px-1 py-1 text-end transition-all duration-200 hover:-translate-y-0.5 ${
        inline ? "" : "absolute bottom-14 end-12"
      }`}
      title={tooltip}
    >
      <div className="flex items-center gap-3.5 rounded-2xl px-3 py-2 transition-colors duration-200 group-hover:bg-canvas/45">
        <img
          src={topSource.icon}
          alt={topSource.name}
          className={`h-10 shrink-0 ${needsInvert(top.source) ? "invert hue-rotate-180" : ""} ${
            top.source === "animation_kobe" ? "w-10 brightness-0 invert" : "w-auto max-w-[120px]"
          }`}
          draggable={false}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink/55">
            {topSource.name} · {t("Winner")}
          </span>
          <div className="flex flex-col gap-0.5 text-[13px] font-medium leading-snug text-ink/75">
            {lines.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
            {overflow > 0 && (
              <span className="text-[12px] text-ink-subtle">{t("+{n} more", { n: overflow })}</span>
            )}
          </div>
        </div>
      </div>
      {otherGroups.length > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-canvas/45 px-3 py-1.5 text-[11px] text-ink-subtle">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
            {t("Also won")}
          </span>
          {otherGroups.map((g) => {
            const meta = awardSourceMeta(g.source);
            return (
              <span
                key={g.source}
                className="font-semibold text-ink/70"
                title={`${meta.name}: ${g.wins.length === 1 ? t("{n} award", { n: g.wins.length }) : t("{n} awards", { n: g.wins.length })}`}
              >
                {meta.shortName}
                {g.wins.length > 1 ? ` ×${g.wins.length}` : ""}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

function needsInvert(source: AwardSourceId): boolean {
  return source === "taaf" || source === "crunchyroll";
}

function formatLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  year: number,
  categoryName: string,
  isAOTY: boolean,
): string {
  const cat = isAOTY ? t("Anime of the Year") : categoryName.replace(/^Best\s+/i, "Best ");
  return `${year} ${cat}`;
}
