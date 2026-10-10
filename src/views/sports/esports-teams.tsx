import { lazy, Suspense, useId, useRef, useEffect, useState, useMemo, type ReactNode } from "react";
import { ArrowRight, ChevronRight, ExternalLink, Search, Users, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { EsportsMatch } from "@/lib/sports/esports-feeds";
import type { EsportsTeam } from "@/lib/sports/esports-profiles";
import {
  fetchEsportsRankedTeamStats,
  type EsportsRankings,
  type EsportsRankedTeamStats,
} from "@/lib/sports/esports-rankings";
import {
  esportsTeamDirectory,
  type EsportsTeamEntry as TeamEntry,
} from "@/lib/sports/esports-team-directory";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import {
  fetchEsportsTeamHistory,
  mergeEsportsTeamHistory,
  type EsportsTeamHistory,
} from "@/lib/sports/esports-team-history";
import { EsportsImage } from "./esports-image";
import "./esports-teams.css";
import type { EsportsTeamSelection } from "./esports-team-dialog";
const TeamDialog = lazy(() =>
  import("./esports-team-dialog").then((module) => ({ default: module.EsportsTeamDialog })),
);

// Official favicon advertised by the provider's public site; identifies the actual data source.
const BO3_LOGO = "/sports/logos/bo3.png";

function RankingSource({ rankings }: { rankings: EsportsRankings }) {
  const t = useT(),
    locale = useUiLanguage();
  return (
    <button className="ea-ranking-source" onClick={() => openUrl(rankings.sourceUrl)}>
      <EsportsImage src={BO3_LOGO} name={rankings.sourceName} />
      <span>
        <strong>{rankings.sourceName}</strong>
        <small>
          {t(rankings.isOfficial ? "Official ranking" : "Provider ranking")} ·{" "}
          {new Date(`${rankings.asOf}T12:00:00`).toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {rankings.stale ? ` · ${t("Saved schedule")}` : ""}
        </small>
      </span>
      <ExternalLink size={14} />
    </button>
  );
}

function matchResult(match: EsportsMatch, id: string): "W" | "L" | null {
  const side = match.teams.find((team) => team.id === id);
  const other = match.teams.find((team) => team.id !== id);
  if (!side || !other || match.state !== "recent") return null;
  if (side.winner === true) return "W";
  if (other.winner === true) return "L";
  if (side.score !== undefined && other.score !== undefined && side.score !== other.score)
    return side.score > other.score ? "W" : "L";
  return null;
}

export function TeamMatches({
  team,
  rankings,
  onClose,
  onMatch,
  children,
}: {
  team: TeamEntry;
  rankings?: EsportsRankings | null;
  onClose: () => void;
  onMatch: (match: EsportsMatch) => void;
  children?: ReactNode;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const id = useId();
  const [nextTeam, setNextTeam] = useState<EsportsTeamSelection | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const game = ESPORTS_GAMES.find((game) => game.id === team.game)!;
  const historyKey = `${team.game}:${team.id}`;
  const [history, setHistory] = useState<{
    key: string;
    data?: EsportsTeamHistory;
    failed?: boolean;
  }>({ key: historyKey });
  const [historyRetry, setHistoryRetry] = useState(0);
  const historySupported = team.game === "rocketleague";
  const historyData = history.key === historyKey ? history.data : undefined;
  const historyFailed = history.key === historyKey && history.failed === true;
  const historyLoading = historySupported && !historyData && !historyFailed;
  const allMatches = useMemo(
    () => mergeEsportsTeamHistory(team.game, team.id, team.matches, historyData?.matches || []),
    [team.game, team.id, team.matches, historyData],
  );
  const recent = allMatches
    .filter((match) => match.state === "recent")
    .sort((a, b) => b.startMs - a.startMs)
    .slice(0, 8);
  const rank = team.ranking;
  const [stats, setStats] = useState<EsportsRankedTeamStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const neighbors =
    rank && rankings
      ? rankings.teams.filter(
          (item) =>
            Math.abs(item.rank - rank.rank) === 1 &&
            item.points !== undefined &&
            rank.points !== undefined &&
            (item.rank < rank.rank ? item.points >= rank.points : item.points <= rank.points),
        )
      : [];
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  useEffect(() => {
    if (!historySupported) return;
    const controller = new AbortController();
    setHistory({ key: historyKey });
    fetchEsportsTeamHistory(team.game, team.id, controller.signal, historyRetry > 0).then(
      (data) => {
        if (!controller.signal.aborted) setHistory({ key: historyKey, data });
      },
      () => {
        if (!controller.signal.aborted) setHistory({ key: historyKey, failed: true });
      },
    );
    return () => controller.abort();
  }, [historySupported, historyKey, team.game, team.id, historyRetry]);
  useEffect(() => {
    if (!rank) return;
    const controller = new AbortController();
    setStats(null);
    setStatsFailed(false);
    void fetchEsportsRankedTeamStats(rank, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setStats(data);
      },
      () => {
        if (!controller.signal.aborted) setStatsFailed(true);
      },
    );
    return () => controller.abort();
  }, [rank, retry]);
  useEffect(() => {
    close.current?.focus();
    return () => {
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
  }, []);
  return (
    <ModalShell closing={false} onDismiss={onClose} labelledBy={id} width={850}>
      <div className="ea-dialog-head">
        <div>
          <span className="ea-kicker">{game.name}</span>
          <h2 id={id}>{team.name}</h2>
        </div>
        <button ref={close} className="sh-icon" onClick={onClose} aria-label={t("Close")}>
          <X size={19} />
        </button>
      </div>
      <div className="ea-team-summary">
        <div className="ea-team-summary-head">
          <EsportsImage src={team.logo} name={team.name} />
          {rank ? (
            <>
              <div>
                <strong>#{rank.rank}</strong>
                <span>{t("Rank")}</span>
              </div>
              {rank.points !== undefined && (
                <div>
                  <strong>{number(rank.points)}</strong>
                  <span>{t("Ranking points")}</span>
                </div>
              )}
              {rank.rankChange !== undefined && (
                <div>
                  <strong>
                    {rank.rankChange > 0 ? "+" : ""}
                    {rank.rankChange}
                  </strong>
                  <span>{t("Rank movement")}</span>
                </div>
              )}
            </>
          ) : (
            (["live", "upcoming", "recent"] as const).map((state) => (
              <div key={state}>
                <strong>
                  {state === "recent" && !recent.length && (historyLoading || historyFailed)
                    ? "—"
                    : allMatches.filter((match) => match.state === state).length}
                </strong>
                <span>
                  {t(
                    state === "live"
                      ? "Live now"
                      : state === "upcoming"
                        ? "Upcoming"
                        : "Recent results",
                  )}
                </span>
              </div>
            ))
          )}
        </div>
        {children}
        {rank && rankings && (
          <section className="ea-ranking-context" aria-label={t("Ranking details")}>
            <RankingSource rankings={rankings} />
            {rank.points !== undefined && neighbors.length > 0 && (
              <dl className="ea-ranking-comparison">
                {neighbors.map((neighbor) => (
                  <div key={neighbor.id}>
                    <dt>
                      {t(neighbor.rank < rank.rank ? "Points behind" : "Points ahead")}{" "}
                      <span>
                        #{neighbor.rank} {neighbor.name}
                      </span>
                    </dt>
                    <dd>{number(Math.abs(rank.points! - neighbor.points!))}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p>{t("This ranking is supplied by Bo3.gg.")}</p>
          </section>
        )}
        {rank && (
          <section className="ea-team-history">
            <div className="ea-directory-heading">
              <strong>{t("Tracked history")}</strong>
              <span>Bo3.gg</span>
            </div>
            <p>{t("Statistics from matches tracked by Bo3.gg.")}</p>
            {stats ? (
              <>
                <div className="ea-team-history-table">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t("Total")}</th>
                        <th>{t("Wins")}</th>
                        <th>{t("Losses")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Matches", stats.matches, stats.matchWins, stats.matchLosses],
                          ["Maps", stats.maps, stats.mapWins, stats.mapLosses],
                          ["Rounds", stats.rounds, stats.roundWins, undefined],
                        ] as const
                      )
                        .filter(([, total]) => total !== undefined)
                        .map(([label, total, wins, losses]) => (
                          <tr key={label}>
                            <th>{t(label)}</th>
                            <td>{number(total!)}</td>
                            <td>{wins !== undefined ? number(wins) : "—"}</td>
                            <td>{losses !== undefined ? number(losses) : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <dl className="ea-team-combat-totals">
                  {(
                    [
                      ["Kills", stats.kills],
                      ["Deaths", stats.deaths],
                      ["Assists", stats.assists],
                    ] as const
                  )
                    .filter(([, total]) => total !== undefined)
                    .map(([label, total]) => (
                      <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{number(total!)}</dd>
                      </div>
                    ))}
                </dl>
              </>
            ) : statsFailed ? (
              <div className="ea-feed-health" role="status">
                <span>{t("Detailed statistics could not be loaded.")}</span>
                <button className="sh-button" onClick={() => setRetry((value) => value + 1)}>
                  {t("Retry")}
                </button>
              </div>
            ) : (
              <div className="ea-team-history-loading" role="status">
                {t("Loading…")}
              </div>
            )}
          </section>
        )}
        {team.ranking && (
          <section className="ea-ranking-roster">
            <div className="ea-directory-heading">
              <strong>{t("Ranking roster")}</strong>
              <span>{rankings?.sourceName || "Bo3.gg"}</span>
            </div>
            <div className="ea-ranking-players">
              {team.ranking.players.map((player) => (
                <button
                  key={player.id}
                  disabled={!player.url}
                  onClick={() => player.url && openUrl(player.url)}
                >
                  <EsportsImage src={player.image} name={player.name} />
                  <strong>{player.name}</strong>
                  {player.url && <ExternalLink size={13} />}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="ea-team-form">
          <strong>{t("Recent results")}</strong>
          {recent.length ? (
            <div className="ea-team-form-results">
              {recent.map((match) => {
                const result = matchResult(match, team.id);
                const opponent = match.teams.find((side) => side.id !== team.id);
                return (
                  <button
                    key={match.id}
                    aria-label={`${t("View team profile")} · ${opponent?.name || ""}`}
                    onClick={() => opponent && setNextTeam({ game: match.game, team: opponent })}
                  >
                    <b data-result={result || "unknown"}>{result ? t(result) : "—"}</b>
                    <EsportsImage src={opponent?.logo} name={opponent?.name || ""} />
                    <span>
                      {opponent?.name}
                      <small>
                        {new Date(match.startMs).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            !historyLoading &&
            !historyFailed && (
              <p>
                {t(
                  historyData?.status === "ready"
                    ? "No completed matches were returned for this team."
                    : "No completed matches in the current feed.",
                )}
              </p>
            )
          )}
          {historyLoading && <p role="status">{t("Loading team results…")}</p>}
          {historyFailed && (
            <div className="ea-feed-health" role="status">
              <span>
                {t("Team results could not be loaded. Your current schedule is still shown.")}
              </span>
              <button className="sh-button" onClick={() => setHistoryRetry((value) => value + 1)}>
                {t("Retry")}
              </button>
            </div>
          )}
          {historyData?.status === "ready" && (
            <p>{t("Results cover the completed matches available from this source.")}</p>
          )}
          {!historySupported && recent.length > 0 && (
            <p>{t("Form shown here covers completed matches in the current feed.")}</p>
          )}
          {historyData?.sourceUrl && (
            <button className="ea-source-link" onClick={() => openUrl(historyData.sourceUrl!)}>
              {historyData.sourceName} · {t("View team profile")}
              <ExternalLink size={14} />
            </button>
          )}
        </section>
        {allMatches.length > 0 && <p className="ea-team-summary-scope">{t("Match center")}</p>}
        {allMatches.map((match) => (
          <div className="ea-team-series" key={match.id}>
            <button
              className="ea-team-series-open"
              aria-label={`${t("Match center")} · ${match.event.name}`}
              onClick={() => {
                onClose();
                onMatch(match);
              }}
            />
            <span>
              <strong>{match.event.name}</strong>
              <small>
                {new Date(match.startMs).toLocaleString(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </small>
            </span>
            <span>
              {match.teams.map((side) => (
                <button
                  className="ea-team-link"
                  key={side.id}
                  onClick={() => setNextTeam({ game: match.game, team: side })}
                  aria-label={`${t("View team profile")} · ${side.name}`}
                >
                  <EsportsImage src={side.logo} name={side.name} />
                  {side.name}
                  <b>{side.score ?? ""}</b>
                </button>
              ))}
            </span>
            <ChevronRight size={17} />
          </div>
        ))}
        <button
          className="ea-source-link"
          onClick={() => openUrl(team.ranking?.url || game.officialUrl)}
        >
          {t(team.ranking?.url ? "View team profile" : "Official esports site")}
          <ExternalLink size={14} />
        </button>
      </div>
      <Suspense fallback={null}>
        {nextTeam && (
          <TeamDialog
            selection={nextTeam}
            matches={allMatches}
            onClose={() => setNextTeam(null)}
            onMatch={onMatch}
          />
        )}
      </Suspense>
    </ModalShell>
  );
}

export function EsportsTeams({
  selected,
  teams,
  matches,
  rankings,
  rankingsLoading = false,
  rankingsFailed = false,
  onTeam,
  onMatch,
  loading = false,
  failed = false,
  onRetry,
}: {
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
  selected: string;
  teams: EsportsTeam[];
  matches: EsportsMatch[];
  rankings?: EsportsRankings | null;
  rankingsLoading?: boolean;
  rankingsFailed?: boolean;
  onTeam: (id: number) => void;
  onMatch: (match: EsportsMatch) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(48);
  const [team, setTeam] = useState<TeamEntry | null>(null);
  useEffect(() => {
    setSearch("");
    setLimit(48);
    setTeam(null);
  }, [selected]);
  const entries = useMemo(
    () => esportsTeamDirectory(matches, rankings?.teams),
    [matches, rankings],
  );
  const sourceTeams = entries.filter(
    (team) =>
      (selected === "all" || selected === team.game) &&
      `${team.name} ${team.ranking?.players.map((player) => player.name).join(" ") || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const dotaTeams =
    selected === "all" || selected === "dota2"
      ? teams.filter((team) =>
          `${team.name} ${team.tag}`.toLowerCase().includes(search.toLowerCase()),
        )
      : [];
  return (
    <>
      <div className="ea-board-heading">
        <div>
          <h3>{t("Teams to know")}</h3>
          <p>
            {t(
              selected === "dota2"
                ? "Dota 2 team ratings and tracked professional records from OpenDota."
                : selected === "cs2" || selected === "all"
                  ? "Current rankings first. Explore teams and their players."
                  : "Live first. Your next series right behind it.",
            )}
          </p>
        </div>
        <label className="ea-team-search">
          <Search size={16} />
          <input
            aria-label={t("Find a team")}
            placeholder={t("Find a team")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(48);
            }}
          />
        </label>
      </div>
      {ESPORTS_GAMES.filter((game) => selected === "all" || game.id === selected).map((game) => {
        const items = sourceTeams.filter((team) => team.game === game.id);
        if (
          !items.length &&
          (game.id !== "dota2" || !dotaTeams.length) &&
          !(game.id === "cs2" && (rankingsLoading || rankingsFailed))
        )
          return null;
        return (
          <section key={game.id} className="ea-directory-group">
            <div className="ea-directory-heading">
              <strong>{game.name}</strong>
              <span>
                {game.id === "dota2" ? (
                  "OpenDota"
                ) : game.id === "cs2" && rankings ? (
                  <RankingSource rankings={rankings} />
                ) : (
                  t("Match center")
                )}
              </span>
            </div>
            {game.id === "cs2" && rankingsLoading && !rankings && (
              <div className="ea-feed-health" role="status">
                {t("Loading…")}
              </div>
            )}
            {game.id === "cs2" && rankingsFailed && (
              <div className="ea-feed-health" role="status">
                {t("Rankings are temporarily unavailable.")}{" "}
                <button className="sh-button" onClick={onRetry}>
                  {t("Retry")}
                </button>
              </div>
            )}
            <div className="ea-team-grid">
              {game.id === "dota2" && dotaTeams.length
                ? dotaTeams.slice(0, selected === "all" ? 12 : 60).map((item) => (
                    <button key={item.id} onClick={() => onTeam(item.id)}>
                      <EsportsImage src={item.logo} name={item.name} />
                      <strong>{item.name}</strong>
                      <small>
                        {t("Rating")} <b>{item.rating?.toFixed(0) ?? "—"}</b>
                      </small>
                      <span className="ea-team-record">
                        {item.wins ?? "—"} {t("W")} · {item.losses ?? "—"} {t("L")}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))
                : (game.id === "cs2" && rankingsLoading && !rankings ? [] : items)
                    .slice(0, selected === "all" && !search ? 12 : limit)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.game === "dota2" && /^\d+$/.test(item.id))
                            onTeam(Number(item.id));
                          else setTeam(item);
                        }}
                      >
                        {item.ranking && <span className="ea-team-rank">#{item.ranking.rank}</span>}
                        <EsportsImage src={item.logo} name={item.name} />
                        <strong>{item.name}</strong>
                        <small>
                          {t(item.ranking?.points !== undefined ? "Ranking points" : "Upcoming")}{" "}
                          <b>
                            {item.ranking?.points !== undefined
                              ? item.ranking.points.toLocaleString(locale, {
                                  maximumFractionDigits: 2,
                                })
                              : item.matches.filter((match) => match.state === "upcoming").length}
                          </b>
                        </small>
                        <span className="ea-team-record">
                          {item.ranking ? (
                            <>
                              {rankings?.sourceName} · {t("Rank")} #{item.ranking.rank}
                            </>
                          ) : (
                            <>
                              {t("Recent results")} ·{" "}
                              {item.matches.filter((match) => match.state === "recent").length}
                            </>
                          )}
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
            </div>
            {game.id === "cs2" && rankings && (
              <button className="ea-source-link" onClick={() => openUrl(rankings.sourceUrl)}>
                {rankings.sourceName} · {t("Rankings")}
                <ExternalLink size={13} />
              </button>
            )}
            {(selected !== "all" || search) && items.length > limit && (
              <button
                className="sh-button ea-directory-more"
                onClick={() => setLimit((value) => value + 48)}
              >
                {t("Load more")}
                <ArrowRight size={15} />
              </button>
            )}
          </section>
        );
      })}
      {!loading && !rankingsLoading && !sourceTeams.length && !dotaTeams.length && (
        <div className="ea-empty">
          <Users size={26} />
          <h3>{t("Explore the official team directory")}</h3>
          <p>{t("Detailed team records are not supplied by this game’s free feed.")}</p>
          <button
            className="sh-button"
            onClick={() =>
              openUrl(
                (ESPORTS_GAMES.find((game) => game.id === selected) || ESPORTS_GAMES[0])
                  .officialUrl,
              )
            }
          >
            {t("Official esports site")}
            <ExternalLink size={15} />
          </button>
        </div>
      )}
      {(loading || failed) && (
        <div className="ea-feed-health" role="status">
          {loading ? (
            <span>{t("Loading…")}</span>
          ) : (
            <button className="sh-button" onClick={onRetry}>
              {t("Retry")}
            </button>
          )}
        </div>
      )}
      {team && (
        <Suspense fallback={null}>
          <TeamDialog
            selection={{ game: team.game as EsportsMatch["game"], team }}
            matches={matches}
            onClose={() => setTeam(null)}
            onMatch={onMatch}
          />
        </Suspense>
      )}
    </>
  );
}
