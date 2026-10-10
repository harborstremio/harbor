import { useT } from "@/lib/i18n";
import { fetchAthlete, fetchGameLog, findLeague } from "@/lib/jl/sports/espn-pages";
import { withTeamDetails, type AthleteProfile, type GameLog } from "@/lib/jl/sports/espn-athlete";
import { isFollowing, toggleFavoritePlayer, useJlFavoritePlayers } from "@/lib/jl/sports/favorites";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { espnHeadshot } from "@/lib/jl/sports/search-parse";
import { artKey } from "@/lib/jl/sports/curated-art";
import { getLeagueLabel } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { FollowToggle, Img, Note, PageHeader, PageShell, Section, Spinner, useLoad } from "./espn-page-parts";

export function AthletePage({ page }: { page: Extract<SportsPage, { kind: "athlete" }> }) {
  const t = useT();
  const { openSportsPage } = useView();
  const { league, athleteId } = page;
  const def = findLeague(league);
  const tag = def?.tag ?? league;
  const players = useJlFavoritePlayers();
  const profile = useLoad(`athlete:${tag}:${athleteId}`, () => fetchAthlete(tag, athleteId));
  const log = useLoad(`gamelog:${tag}:${athleteId}`, () => fetchGameLog(tag, athleteId));
  const a = profile.data;
  const name = a?.name ?? page.name ?? "";
  const headshot = a?.headshot ?? espnHeadshot(tag, athleteId);
  const following = isFollowing(players, tag, athleteId);

  const toggle = () => {
    if (!name) return;
    const existing = players.find((p) => p.league === tag && p.id === athleteId);
    toggleFavoritePlayer(
      existing ?? {
        league: tag,
        id: athleteId,
        name,
        teamId: a?.follow.teamId ?? null,
        teamName: a?.follow.teamName ?? null,
        headshot: a?.follow.headshot ?? headshot,
        position: a?.follow.position ?? null,
      },
    );
  };

  const team = a?.team ?? null;
  return (
    <PageShell>
      <PageHeader
        artRef={artKey.athlete(tag, athleteId)}
        image={headshot}
        round
        color={team?.color}
        eyebrow={
          team ? (
            <button
              onClick={() => openSportsPage({ kind: "team", league: tag, teamId: team.id, name: team.name })}
              className="flex items-center gap-2 rounded uppercase hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <Img src={team.logo} className="h-6 w-6 object-contain" />
              {team.name}
            </button>
          ) : def ? (
            getLeagueLabel(def)
          ) : (
            tag
          )
        }
        title={name || (profile.loading ? "" : t("Player"))}
        facts={[a?.jersey, a?.position]}
        actions={name ? <FollowToggle following={following} name={name} onToggle={toggle} /> : null}
      />
      {profile.loading ? (
        <Spinner />
      ) : !a ? (
        <Note>{t("Player details are unavailable right now.")}</Note>
      ) : (
        <>
          {a.stats.length > 0 && (
            <Section title={a.statsLabel ?? t("Season stats")}>
              <dl className="grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
                {a.stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-edge-soft/55 bg-elevated p-4">
                    <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">{s.label}</dt>
                    <dd className="mt-1 text-2xl font-black tabular-nums text-ink">{s.value}</dd>
                    {s.rank && <dd className="text-[11.5px] font-semibold text-accent">{s.rank}</dd>}
                  </div>
                ))}
              </dl>
            </Section>
          )}
          {a.bio.length > 0 && (
            <Section title={t("Bio")}>
              <dl className="grid max-w-4xl gap-x-6 gap-y-2 sm:grid-cols-2">
                {a.bio.map((b) => (
                  <div key={b.label} className="flex gap-3 border-b border-edge-soft/40 pb-2 text-[13.5px]">
                    <dt className="w-32 shrink-0 text-ink-subtle">{t(b.label)}</dt>
                    <dd className="text-ink">{b.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
          {log.data && log.data.rows.length > 0 && <GameLogTable log={log.data} team={a.team} />}
        </>
      )}
    </PageShell>
  );
}

function GameLogTable({ log, team }: { log: GameLog; team: AthleteProfile["team"] }) {
  const t = useT();
  const { openMatchDetail } = useView();
  const columns = log.columns.slice(0, 10);
  return (
    <Section title={log.label ? t("Game log · {season}", { season: log.label }) : t("Game log")}>
      <div className="overflow-x-auto rounded-xl border border-edge-soft/55 bg-elevated">
        <table className="w-full text-[13px] tabular-nums">
          <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-4 py-2 text-start font-semibold">{t("Date")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("Opponent")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("Result")}</th>
              {columns.map((c, i) => (
                <th key={`${c}:${i}`} className="px-2.5 py-2 text-end font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.rows.map((r) => {
              const game = r.game ? withTeamDetails(r.game, team) : null;
              return (
                <tr key={r.eventId} className="border-t border-edge-soft/50">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-subtle">
                    {r.startMs ? new Date(r.startMs).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                  </td>
                  <td className="px-2 py-1.5">
                    {game ? (
                      <button
                        onClick={() => openMatchDetail(game)}
                        title={t("Game details")}
                        className="flex items-center gap-2 rounded text-start text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      >
                        <span className="text-ink-subtle">{r.atVs}</span>
                        <Img src={r.opponent.logo} className="h-5 w-5 shrink-0 object-contain" />
                        {r.opponent.abbr || r.opponent.name}
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-ink">
                        <span className="text-ink-subtle">{r.atVs}</span>
                        <Img src={r.opponent.logo} className="h-5 w-5 shrink-0 object-contain" />
                        {r.opponent.abbr || r.opponent.name}
                      </span>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-2 font-semibold ${
                      r.result === "W" ? "text-emerald-500" : r.result === "L" ? "text-danger" : "text-ink-muted"
                    }`}
                  >
                    {[r.result, r.score].filter(Boolean).join(" ")}
                  </td>
                  {columns.map((c, i) => (
                    <td key={`${c}:${i}`} className="px-2.5 py-2 text-end text-ink-muted">
                      {r.stats[i] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
