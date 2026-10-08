import { useT } from "@/lib/i18n";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { getGroupLabel, getLeagueLabel, LEAGUE_GROUPS, LEAGUES } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { Img, PageShell } from "./espn-page-parts";
import { WorldSportsSection } from "./world-sports";

/** Every league the Sports Hub covers, by sport; each opens its league page. */
export function LeaguesPage(_props: { page: Extract<SportsPage, { kind: "leagues" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  return (
    <PageShell>
      <h1 className="text-3xl font-black text-ink md:text-4xl">{t("Leagues")}</h1>
      {LEAGUE_GROUPS.map((group) => {
        const list = LEAGUES.filter((l) => l.group === group.key);
        if (list.length === 0) return null;
        return (
          <section key={group.key} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {group.icon} {getGroupLabel(group)}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((l) => (
                <button
                  key={l.key}
                  onClick={() => openSportsPage({ kind: "league", league: l.tag, name: getLeagueLabel(l) })}
                  className="flex items-center gap-3 rounded-xl border border-edge-soft/55 bg-elevated px-4 py-3 text-start transition-colors hover:border-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <Img src={l.logo} className="h-10 w-10 shrink-0 object-contain" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] font-semibold text-ink">{getLeagueLabel(l)}</span>
                    <span className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">{l.tag}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {/* AllSports leagues from around the world (shows how to add a key when there is none). */}
      <WorldSportsSection />
    </PageShell>
  );
}
