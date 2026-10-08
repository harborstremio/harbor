import { List } from "lucide-react";
import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { standingColumns } from "@/lib/jl/sports/espn-league";
import {
  fetchLeagueGames,
  fetchLeagueLeaders,
  fetchLeagueTeams,
  fetchStandings,
  findLeague,
} from "@/lib/jl/sports/espn-pages";
import { splitSchedule } from "@/lib/jl/sports/espn-team";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import { getGroupLabel, getLeagueLabel, LEAGUE_GROUPS } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import {
  GameCard,
  Img,
  Note,
  PageHeader,
  PageShell,
  PersonTile,
  Pill,
  Section,
  Shelf,
  Spinner,
  StandingsTable,
  useLoad,
} from "./espn-page-parts";

export function LeaguePage({ page }: { page: Extract<SportsPage, { kind: "league" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  const def = findLeague(page.league);
  if (!def) {
    return (
      <PageShell>
        <PageHeader image={null} title={page.name ?? page.league} facts={[]} />
        <Note>{t("This league isn't available.")}</Note>
      </PageShell>
    );
  }
  const group = LEAGUE_GROUPS.find((g) => g.key === def.group);
  return (
    <PageShell>
      <PageHeader
        image={def.logo}
        eyebrow={group ? `${group.icon} ${getGroupLabel(group)}` : def.tag}
        title={getLeagueLabel(def)}
        facts={[]}
        actions={
          <Pill onClick={() => openSportsPage({ kind: "leagues" })}>
            <List size={13} />
            {t("All leagues")}
          </Pill>
        }
      />
      <LeagueBody tag={def.tag} group={def.group} />
    </PageShell>
  );
}

function LeagueBody({ tag, group }: { tag: string; group: string }) {
  const t = useT();
  const { openSportsPage } = useView();
  const games = useLoad(`league-games:${tag}`, () => fetchLeagueGames(tag));
  const standings = useLoad(`standings:${tag}`, () => fetchStandings(tag));
  const leaders = useLoad(`league-leaders:${tag}`, () => fetchLeagueLeaders(tag));
  const teams = useLoad(`league-teams:${tag}`, () => fetchLeagueTeams(tag));
  const { upcoming, results } = useMemo(() => splitSchedule(games.data ?? []), [games.data]);
  const tables = useMemo(() => standings.data ?? [], [standings.data]);
  const columns = useMemo(() => standingColumns(group, tables), [group, tables]);
  const openTeam = (id: string, name: string) => openSportsPage({ kind: "team", league: tag, teamId: id, name });

  if (games.loading && standings.loading && teams.loading) return <Spinner />;
  const nothing =
    !games.loading &&
    !standings.loading &&
    !leaders.loading &&
    !teams.loading &&
    upcoming.length + results.length + tables.length + (leaders.data?.length ?? 0) + (teams.data?.length ?? 0) === 0;
  if (nothing) return <Note>{t("League details are unavailable right now.")}</Note>;

  return (
    <>
      {upcoming.length > 0 && (
        <Section title={t("Live & upcoming")}>
          <Shelf>
            {upcoming.slice(0, 16).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </Shelf>
        </Section>
      )}
      {results.length > 0 && (
        <Section title={t("Results")}>
          <Shelf>
            {results.slice(0, 16).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </Shelf>
        </Section>
      )}
      {tables.length > 0 && (
        <Section title={t("Standings")}>
          <div className="grid gap-4 xl:grid-cols-2">
            {tables.map((g) => (
              <StandingsTable key={g.name} group={g} columns={columns} onTeam={openTeam} />
            ))}
          </div>
        </Section>
      )}
      {(leaders.data?.length ?? 0) > 0 && (
        <Section title={t("League leaders")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leaders.data?.map((c) => (
              <div key={c.key} className="flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-subtle">{c.label}</p>
                {c.leaders.map((l, i) => (
                  <PersonTile
                    key={`${c.key}:${l.athleteId ?? i}`}
                    name={`${i + 1}. ${l.name ?? ""}`}
                    image={l.headshot ?? (l.athleteId ? espnHeadshot(tag, l.athleteId) : null)}
                    line={l.team}
                    value={l.value}
                    onOpen={
                      l.athleteId
                        ? () =>
                            openSportsPage({
                              kind: "athlete",
                              league: tag,
                              athleteId: l.athleteId as string,
                              name: l.name ?? undefined,
                            })
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}
      {(teams.data?.length ?? 0) > 0 && (
        <Section title={t("Teams")}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teams.data?.map((team) => (
              <button
                key={team.id}
                onClick={() => openTeam(team.id, team.name)}
                className="flex items-center gap-3 rounded-xl border border-edge-soft/55 bg-elevated px-3 py-2.5 text-start transition-colors hover:border-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <Img src={team.logo} className="h-9 w-9 shrink-0 object-contain" />
                <span className="truncate text-[13.5px] font-semibold text-ink">{team.name}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
