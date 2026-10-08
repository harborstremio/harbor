import { Trophy } from "lucide-react";
import { useMemo } from "react";
import { getLeagueLabel } from "@/lib/sports/espn";
import { useT } from "@/lib/i18n";
import { isFollowing, toggleFavoriteTeam, useJlSportsFavorites } from "@/lib/jl/sports/favorites";
import { groupForTeam, standingColumns } from "@/lib/jl/sports/espn-league";
import {
  fetchAsTeamSchedule,
  fetchRoster,
  fetchStandings,
  fetchTeamInfo,
  fetchTeamLeaders,
  findLeague,
} from "@/lib/jl/sports/espn-pages";
import { leadersSource, splitSchedule } from "@/lib/jl/sports/espn-team";
import { fetchTeamGames } from "@/lib/jl/sports/feed";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import {
  FollowToggle,
  GameCard,
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

const ROSTER_SHOWN = 60;

export function TeamPage({ page }: { page: Extract<SportsPage, { kind: "team" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  const { league, teamId } = page;
  const def = findLeague(league);
  const tag = def?.tag ?? league;
  const favorites = useJlSportsFavorites();

  const info = useLoad(`info:${tag}:${teamId}`, () => fetchTeamInfo(tag, teamId));
  const games = useLoad(`games:${tag}:${teamId}`, () => fetchTeamGames(tag, teamId));
  const name = info.data?.name ?? page.name ?? "";
  const following = isFollowing(favorites, tag, teamId);

  return (
    <PageShell>
      <PageHeader
        image={info.data?.logo ?? null}
        eyebrow={def ? getLeagueLabel(def) : tag}
        title={name || (info.loading ? "" : t("Team"))}
        color={info.data?.color}
        facts={[info.data?.record, info.data?.standing, info.data?.venue]}
        actions={
          <>
            {name && (
              <FollowToggle
                following={following}
                name={name}
                onToggle={() => toggleFavoriteTeam({ league: tag, id: teamId, name })}
              />
            )}
            {def && (
              <Pill onClick={() => openSportsPage({ kind: "league", league: def.tag, name: getLeagueLabel(def) })}>
                <Trophy size={13} />
                {t("{league} standings & leaders", { league: getLeagueLabel(def) })}
              </Pill>
            )}
          </>
        }
      />
      {info.loading && games.loading ? (
        <Spinner />
      ) : (
        <>
          <Schedule tag={tag} teamId={teamId} teamName={name} games={games.data ?? []} loading={games.loading} />
          <Leaders tag={tag} teamId={teamId} games={games.data ?? []} />
          <StandingsSnippet tag={tag} teamId={teamId} group={def?.group ?? ""} />
          <RosterSection tag={tag} teamId={teamId} teamName={name} />
        </>
      )}
    </PageShell>
  );
}

function Schedule({
  tag,
  teamId,
  teamName,
  games,
  loading,
}: {
  tag: string;
  teamId: string;
  teamName: string;
  games: Parameters<typeof splitSchedule>[0];
  loading: boolean;
}) {
  const t = useT();
  const { upcoming, results } = useMemo(() => splitSchedule(games), [games]);
  if (loading) return null;
  if (upcoming.length === 0 && results.length === 0) {
    return <AsSchedule tag={tag} teamName={teamName} />;
  }
  return (
    <>
      {upcoming.length > 0 && (
        <Section title={t("Upcoming games")}>
          <Shelf>
            {upcoming.slice(0, 12).map((g) => (
              <GameCard key={g.id} game={g} teamId={teamId} />
            ))}
          </Shelf>
        </Section>
      )}
      {results.length > 0 && (
        <Section title={t("Results")}>
          <Shelf>
            {results.slice(0, 12).map((g) => (
              <GameCard key={g.id} game={g} teamId={teamId} />
            ))}
          </Shelf>
        </Section>
      )}
    </>
  );
}

/** ESPN had no schedule: AllSports, only with the viewer's own key. */
function AsSchedule({ tag, teamName }: { tag: string; teamName: string }) {
  const t = useT();
  const { settings } = useSettings();
  const { openSportsPage } = useView();
  const key = settings.allsportsKey?.trim() ?? "";
  const as = useLoad(`as:${tag}:${teamName}:${key ? "k" : ""}`, () =>
    key && teamName ? fetchAsTeamSchedule(key, tag, teamName) : Promise.resolve(null),
  );
  if (key && as.loading) return null;
  const rows = as.data ? [...as.data.upcoming, ...as.data.results] : [];
  if (rows.length === 0) return <Note>{t("No games listed right now.")}</Note>;
  return (
    <Section title={t("Schedule")}>
      <div className="flex max-w-3xl flex-col gap-1.5">
        {rows.map((g) => (
          <button
            key={g.id}
            onClick={() =>
              openSportsPage({ kind: "match-center", sport: as.data?.sport ?? "", matchId: g.id, name: `${g.away} at ${g.home}` })
            }
            className="flex items-center gap-3 rounded-xl border border-edge-soft/55 bg-elevated px-4 py-2.5 text-start text-[13px] transition-colors hover:border-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <span className="w-24 shrink-0 text-ink-subtle">
              {g.startMs ? new Date(g.startMs).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {g.away} {g.state !== "pre" ? g.awayScore ?? "" : ""} · {g.home} {g.state !== "pre" ? g.homeScore ?? "" : ""}
            </span>
            <span className={g.state === "in" ? "text-danger" : "text-ink-subtle"}>
              {g.state === "in" ? t("Live") : g.state === "post" ? t("Final") : t("Upcoming")}
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Leaders({ tag, teamId, games }: { tag: string; teamId: string; games: Parameters<typeof leadersSource>[0] }) {
  const t = useT();
  const { openSportsPage } = useView();
  const source = useMemo(() => leadersSource(games), [games]);
  const leaders = useLoad(`leaders:${tag}:${teamId}:${source?.game.id ?? ""}`, () =>
    source ? fetchTeamLeaders(source.game, teamId) : Promise.resolve([]),
  );
  const list = leaders.data ?? [];
  if (!source || list.length === 0) return null;
  return (
    <Section title={source.season ? t("Team leaders") : t("Last game leaders")}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((l) => (
          <PersonTile
            key={`${l.category}:${l.athlete}`}
            name={l.athlete}
            image={l.headshot ?? (l.athleteId ? espnHeadshot(tag, l.athleteId) : null)}
            line={[l.category, l.position].filter(Boolean).join(" · ")}
            value={l.value}
            onOpen={
              l.athleteId
                ? () => openSportsPage({ kind: "athlete", league: tag, athleteId: l.athleteId as string, name: l.athlete })
                : undefined
            }
          />
        ))}
      </div>
    </Section>
  );
}

function StandingsSnippet({ tag, teamId, group }: { tag: string; teamId: string; group: string }) {
  const t = useT();
  const { openSportsPage } = useView();
  const standings = useLoad(`standings:${tag}`, () => fetchStandings(tag));
  const table = standings.data ? groupForTeam(standings.data, teamId) : null;
  if (!table) return null;
  const columns = standingColumns(group, [table]);
  return (
    <Section title={t("Standings")}>
      <div className="max-w-4xl">
        <StandingsTable
          group={table}
          columns={columns}
          highlightId={teamId}
          onTeam={(id, name) => id !== teamId && openSportsPage({ kind: "team", league: tag, teamId: id, name })}
        />
      </div>
    </Section>
  );
}

function RosterSection({ tag, teamId, teamName }: { tag: string; teamId: string; teamName: string }) {
  const t = useT();
  const { openSportsPage } = useView();
  const roster = useLoad(`roster:${tag}:${teamId}`, () => fetchRoster(tag, teamId));
  if (roster.loading) return null;
  const players = roster.data?.players ?? [];
  if (players.length === 0) return <Note>{t("Roster not available.")}</Note>;
  return (
    <Section
      title={t("Roster")}
      aside={roster.data?.coach ? <span className="text-[12px] text-ink-subtle">{t("Head coach {name}", { name: roster.data.coach })}</span> : null}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.slice(0, ROSTER_SHOWN).map((p) => (
          <PersonTile
            key={p.id}
            name={p.name}
            image={p.headshot}
            line={[p.jersey ? `#${p.jersey}` : null, p.position, p.detail].filter(Boolean).join(" · ")}
            onOpen={() => openSportsPage({ kind: "athlete", league: tag, athleteId: p.id, name: p.name })}
          />
        ))}
      </div>
      {players.length > ROSTER_SHOWN && (
        <Note>{t("{n} more on the {team} roster", { n: players.length - ROSTER_SHOWN, team: teamName })}</Note>
      )}
    </Section>
  );
}
