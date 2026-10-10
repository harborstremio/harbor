import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  Play,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { ESPORTS_GAMES, type EsportsGameDef } from "@/lib/sports/esports-catalog";
import type { EsportsMatch, EsportsTeam } from "@/lib/sports/esports-feeds";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import { EsportsTeams } from "./esports-teams";
import { useEsports } from "./use-esports";
import { EsportsImage, EsportsGameLogo } from "./esports-image";
import { EsportsBroadcast, StreamPlatform } from "./esports-broadcast";
import { SportsVideoPreview } from "./sports-video-preview";
import type { EsportsTeamSelection } from "./esports-team-dialog";
import { ESPORTS_ROW_GAMES } from "@/lib/sports/esports-series";
import { EsportsEventsRow, type EsportsEventSummary } from "./esports-events-row";
import "./esports-hub.css";
const TeamDialog = lazy(() =>
  import("./esports-team-dialog").then((m) => ({ default: m.EsportsTeamDialog })),
);
const EventPage = lazy(() =>
  import("./esports-event-page").then((module) => ({
    default: module.EsportsEventPage,
  })),
);

const Match = lazy(() =>
  import("./esports-match").then((module) => ({
    default: module.EsportsMatchView,
  })),
);
const Team = lazy(() =>
  import("./esports-profile").then((module) => ({
    default: module.EsportsTeamProfile,
  })),
);
type Section = "matches" | "results" | "teams" | "watch";
const gameDef = (id: string) => ESPORTS_GAMES.find((game) => game.id === id);

export function EsportsMatchRow({
  match,
  onOpen,
  onWatch,
  onTeam,
}: {
  match: EsportsMatch;
  onOpen: () => void;
  onTeam: (team: EsportsTeam) => void;
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const def = gameDef(match.game);
  return (
    <article className={`ea-match-row ${match.state === "live" ? "is-live" : ""}`}>
      <div className="ea-match-main">
        <button
          className="ea-match-event-open"
          onClick={onOpen}
          aria-label={`${t("Match center")} · ${match.teams.map((team) => team.name).join(" · ")}`}
        />
        <span className="ea-match-time">
          {match.state === "live" ? (
            <b className="ea-live">
              <i />
              {t("Live now")}
            </b>
          ) : match.state === "recent" ? (
            <b>{t("Final")}</b>
          ) : (
            <b>
              {new Date(match.startMs).toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </b>
          )}
          <small>
            {match.bestOf ? t("Best of {count}", { count: match.bestOf }) : def?.shortName}
          </small>
        </span>
        <span className="ea-match-teams">
          {match.teams.map((team, index) => (
            <button
              className="ea-team-link"
              key={index}
              onClick={() => onTeam(team)}
              aria-label={`${t("View team profile")} · ${team.name}`}
            >
              <EsportsImage src={team.logo} name={team.name} />
              <strong>{team.name}</strong>
              <b>{match.state !== "upcoming" && team.score !== undefined ? team.score : ""}</b>
            </button>
          ))}
        </span>
        <span className="ea-match-stage">
          {match.event.stage || def?.name}
          <small>
            {match.game === "dota2" && match.state === "recent"
              ? t("Match statistics")
              : t("Match center")}
          </small>
        </span>
        <ChevronRight size={17} />
      </div>
      {match.streams.length > 0 && match.state !== "recent" && (
        <button
          className="ea-row-watch"
          onClick={() => onWatch(match.streams[0])}
          aria-label={`${t("Watch broadcast")} · ${match.teams.map((team) => team.name).join(" vs ")}`}
        >
          <Play size={15} />
          <span>{t("Watch")}</span>
        </button>
      )}
    </article>
  );
}

function GameRail({ selected, onChange }: { selected: string; onChange: (game: string) => void }) {
  const t = useT();
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  return (
    <div
      className="ea-game-rail"
      ref={ref}
      {...handlers}
      role="group"
      aria-label={t("Filter by game")}
    >
      <button aria-pressed={selected === "all"} onClick={() => onChange("all")}>
        <span className="ea-game-all">
          <Gamepad2 size={28} />
        </span>
        <strong>{t("All games")}</strong>
      </button>
      {ESPORTS_GAMES.map((game) => (
        <button
          key={game.id}
          aria-pressed={selected === game.id}
          onClick={() => onChange(game.id)}
          style={{ "--ea-game-accent": game.accent } as CSSProperties}
        >
          <EsportsGameLogo game={game} />
          <strong>{game.shortName}</strong>
        </button>
      ))}
    </div>
  );
}

function BroadcastTiles({
  games,
  onWatch,
}: {
  games: EsportsGameDef[];
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  return (
    <div className="ea-watch-grid">
      {games.map((game) => (
        <article
          key={game.id}
          className="ea-watch-card"
          style={{ "--ea-game-accent": game.accent } as CSSProperties}
        >
          <div className="ea-watch-art">
            {game.art && (
              <img
                src={game.art}
                alt=""
                loading="lazy"
                onError={(event) => (event.currentTarget.style.display = "none")}
              />
            )}
            <EsportsGameLogo game={game} />
          </div>
          <div className="ea-watch-info">
            <h3>{game.name}</h3>
            <p>{t("Official channels")}</p>
            <div>
              {game.broadcasts.map((stream) => (
                <button className="sh-button" key={stream.url} onClick={() => onWatch(stream)}>
                  <StreamPlatform platform={stream.platform} />
                  <span>{stream.title}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            <button className="ea-source-link" onClick={() => openUrl(game.officialUrl)}>
              {t("Official schedule")}
              <ExternalLink size={13} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EsportsHub({ active, refresh = 0 }: { active: boolean; refresh?: number }) {
  const t = useT();
  const locale = useUiLanguage();
  const [selected, setSelected] = useState("all");
  const [section, setSection] = useState<Section>("matches");
  const [search, setSearch] = useState("");
  const [tournament, setTournament] = useState("");
  const [date, setDate] = useState("");
  const [retry, setRetry] = useState(0);
  const {
    feeds,
    pending,
    teams,
    teamsLoading,
    teamsFailed,
    rankings,
    rankingsLoading,
    rankingsFailed,
    now,
  } = useEsports(selected, active, refresh + retry);
  const [match, setMatch] = useState<EsportsMatch | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<EsportsTeamSelection | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [stream, setStream] = useState<EsportsStream | null>(null);
  const [eventPage, setEventPage] = useState<EsportsEventSummary | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const { ref: leagueRail, handlers: leagueHandlers } = useDragScroll<HTMLDivElement>();
  const { ref: teamsRail, handlers: teamsHandlers } = useDragScroll<HTMLDivElement>();
  const relevantFeeds = Object.values(feeds).filter(
    (feed) => feed && (selected === "all" || feed.game === selected),
  );
  const rowGames = useMemo(
    () =>
      selected === "all"
        ? ESPORTS_ROW_GAMES
        : ESPORTS_ROW_GAMES.filter((game) => game === selected),
    [selected],
  );
  const matches = useMemo(() => {
    const logoById = new Map(teams.map((team) => [String(team.id), team.logo]));
    const list = Object.values(feeds)
      .filter((feed) => feed && (selected === "all" || feed.game === selected))
      .flatMap((feed) =>
        feed!.matches.filter((item) => {
          if (item.state === "upcoming")
            return item.startMs >= now && item.startMs <= now + 30 * 86400000;
          if (item.state === "recent")
            return item.startMs >= now - 72 * 3600000 && item.startMs <= now;
          return (
            feed!.status === "ready" &&
            now - feed!.fetchedAt < 3 * 60000 &&
            (!item.updatedMs || now - item.updatedMs < 5 * 60000)
          );
        }),
      )
      .map((item) =>
        item.game === "dota2"
          ? {
              ...item,
              teams: item.teams.map((team) => ({
                ...team,
                logo: team.logo || logoById.get(team.id),
              })) as EsportsMatch["teams"],
            }
          : item,
      );
    return [...new Map(list.map((item) => [`${item.game}:${item.id}`, item])).values()];
  }, [feeds, teams, selected, now]);
  const live = matches.filter((item) => item.state === "live");
  const upcoming = matches
    .filter((item) => item.state === "upcoming")
    .sort((a, b) => a.startMs - b.startMs);
  const results = matches
    .filter((item) => item.state === "recent")
    .sort((a, b) => b.startMs - a.startMs);
  const mainMatches = section === "results" ? results : [...live, ...upcoming];
  const events = [
    ...new Map(
      mainMatches.map((item) => [
        `${item.game}:${item.event.id}`,
        {
          key: `${item.game}:${item.event.id}`,
          ...item.event,
          game: item.game,
        },
      ]),
    ).values(),
  ];
  const filtered = mainMatches.filter(
    (item) =>
      (!tournament || `${item.game}:${item.event.id}` === tournament) &&
      (!date || new Date(item.startMs).toLocaleDateString("en-CA") === date) &&
      `${item.teams.map((team) => team.name).join(" ")} ${item.event.name} ${gameDef(item.game)?.name}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const grouped = [
    ...new Set(
      filtered.map(
        (item) =>
          `${item.game}:${item.event.id}:${new Date(item.startMs).toLocaleDateString("en-CA")}`,
      ),
    ),
  ].map((key) => ({
    key,
    games: filtered.filter(
      (item) =>
        `${item.game}:${item.event.id}:${new Date(item.startMs).toLocaleDateString("en-CA")}` ===
        key,
    ),
  }));
  const hero = live[0] || upcoming[0];
  const featured = gameDef(hero?.game || selected) || gameDef("cs2")!;
  const recentTeams = teams.filter(
    (team) => team.lastMatchTime && team.lastMatchTime >= now - 90 * 86400000,
  );
  const displayGames =
    selected === "all" ? ESPORTS_GAMES : ESPORTS_GAMES.filter((game) => game.id === selected);
  const busy = pending.length > 0;
  const changeGame = (id: string) => {
    setSelected(id);
    setTournament("");
    setDate("");
    setSearch("");
  };
  const changeSection = (value: Section) => {
    setSection(value);
    setTournament("");
    setDate("");
    setSearch("");
  };
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = content.current?.animate(
      [
        { opacity: 0.5, transform: "translateY(5px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [selected, section]);

  return (
    <section className="esports-arena" aria-label={t("Esports arena")}>
      <div className="ea-heading">
        <div>
          <span className="ea-kicker">HARBOR ESPORTS</span>
          <h2>{t("Pick your game. Find your people.")}</h2>
        </div>
        <span className="ea-free">
          <Play size={13} />
          {t("Official streams, one click away")}
        </span>
      </div>
      <GameRail selected={selected} onChange={changeGame} />
      <div
        className="ea-feature"
        data-sports-preview-trigger
        style={{ "--ea-game-accent": featured.accent } as CSSProperties}
      >
        {featured.art && (
          <img
            className="ea-feature-art"
            src={featured.art}
            alt=""
            key={featured.art}
            onError={(event) => (event.currentTarget.style.display = "none")}
          />
        )}
        {hero && (
          <SportsVideoPreview
            query={{
              names: hero.teams.map((team) => team.name),
              league: hero.game,
              eventTitle: hero.event.name,
              eventStartMs: hero.startMs,
            }}
            title={hero.event.name}
            enabled={active && !match && !stream && !teamId}
          />
        )}
        <div className="ea-feature-copy">
          <div className="ea-feature-meta">
            <EsportsGameLogo game={featured} />
            <span>{hero ? hero.event.name : featured.name}</span>
            {hero?.state === "live" && (
              <b className="ea-live">
                <i />
                {t("Live now")}
              </b>
            )}
          </div>
          {hero ? (
            <>
              <h2>
                <button
                  className="ea-team-link"
                  onClick={() => setSelectedTeam({ game: hero.game, team: hero.teams[0] })}
                >
                  {hero.teams[0].name}
                </button>
                <span>{t("vs")}</span>
                <button
                  className="ea-team-link"
                  onClick={() => setSelectedTeam({ game: hero.game, team: hero.teams[1] })}
                >
                  {hero.teams[1].name}
                </button>
              </h2>
              <p>
                {hero.state === "live"
                  ? t("Live match")
                  : new Date(hero.startMs).toLocaleString(locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                {hero.bestOf && ` · ${t("Best of {count}", { count: hero.bestOf })}`}
              </p>
            </>
          ) : (
            <>
              <h2>
                {featured.name}
                <span>{t("The next match starts here.")}</span>
              </h2>
              <p>{t("Explore the games, meet the teams, and watch the official channels.")}</p>
            </>
          )}
          <div className="ea-feature-actions">
            {hero?.streams[0] ? (
              <button
                className="sh-button sh-button-primary"
                onClick={() => setStream(hero.streams[0])}
              >
                <Play size={17} />
                {t("Watch broadcast")}
              </button>
            ) : hero ? (
              <button className="sh-button sh-button-primary" onClick={() => setMatch(hero)}>
                {t("Match center")}
                <ArrowRight size={17} />
              </button>
            ) : (
              featured.broadcasts[0] && (
                <button
                  className="sh-button sh-button-primary"
                  onClick={() => setStream(featured.broadcasts[0])}
                >
                  <Play size={17} />
                  {t("Open official channel")}
                </button>
              )
            )}
            {hero?.streams.length ? (
              <button className="sh-button" onClick={() => setMatch(hero)}>
                {t("Match center")}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button className="sh-button" onClick={() => changeSection("watch")}>
                {t("All broadcasts")}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>
        {hero && (
          <div className="ea-feature-versus">
            <button
              className="ea-team-link"
              onClick={() => setSelectedTeam({ game: hero.game, team: hero.teams[0] })}
              aria-label={`${t("View team profile")} · ${hero.teams[0].name}`}
            >
              <EsportsImage src={hero.teams[0].logo} name={hero.teams[0].name} />
            </button>
            <span>
              {hero.state === "live" && hero.teams.every((team) => team.score !== undefined)
                ? `${hero.teams[0].score} : ${hero.teams[1].score}`
                : "VS"}
            </span>
            <button
              className="ea-team-link"
              onClick={() => setSelectedTeam({ game: hero.game, team: hero.teams[1] })}
              aria-label={`${t("View team profile")} · ${hero.teams[1].name}`}
            >
              <EsportsImage src={hero.teams[1].logo} name={hero.teams[1].name} />
            </button>
          </div>
        )}
        <div className="ea-feature-footer">
          <span>
            <Radio size={14} />
            {t("Live now")} <b>{live.length}</b>
          </span>
          <span>
            <CalendarDays size={14} />
            {t("Upcoming")} <b>{upcoming.length}</b>
          </span>
          <span>
            <Gamepad2 size={14} />
            {t("Games")} <b>{ESPORTS_GAMES.length}</b>
          </span>
          <small>{t("Broadcasts are provided by their organizers.")}</small>
        </div>
      </div>
      <div className="ea-tabs" role="group" aria-label={t("Esports sections")}>
        {(
          [
            ["matches", "Live & upcoming", Radio],
            ["results", "Results", Trophy],
            ["teams", "Teams", Users],
            ["watch", "Watch", Play],
          ] as const
        ).map(([key, label, Icon]) => (
          <button key={key} aria-pressed={section === key} onClick={() => changeSection(key)}>
            <Icon size={16} />
            {t(label)}
            {key === "matches" && live.length > 0 && <b>{live.length}</b>}
          </button>
        ))}
        <button
          className="ea-refresh"
          aria-label={t("Refresh schedules")}
          disabled={busy}
          onClick={() => setRetry((value) => value + 1)}
        >
          <RefreshCw size={16} className={busy ? "ea-rotating" : ""} />
        </button>
      </div>
      <div ref={content} className="ea-content">
        {section === "matches" && (
          <EsportsEventsRow
            feeds={relevantFeeds}
            games={rowGames}
            active={active}
            refresh={refresh + retry}
            onOpen={setEventPage}
          />
        )}
        {(section === "matches" || section === "results") && (
          <>
            <div className="ea-board-heading">
              <div>
                <h3>{t(section === "results" ? "Recent results" : "Match center")}</h3>
                <p>
                  {t(
                    section === "results"
                      ? "Completed matches from the last 48 hours."
                      : "Live first. Your next series right behind it.",
                  )}
                </p>
              </div>
              <div className="ea-filters">
                <label>
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("Find a team or tournament")}
                    aria-label={t("Find a team or tournament")}
                  />
                </label>
                <label className="ea-date">
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    aria-label={t("Choose date")}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  {date && (
                    <button onClick={() => setDate("")} aria-label={t("Clear date filter")}>
                      ×
                    </button>
                  )}
                </label>
              </div>
            </div>
            {events.length > 1 && (
              <div
                className="ea-event-filters"
                ref={leagueRail}
                {...leagueHandlers}
                role="group"
                aria-label={t("Filter by tournament")}
              >
                <button aria-pressed={!tournament} onClick={() => setTournament("")}>
                  <Trophy size={17} />
                  {t("All tournaments")}
                </button>
                {events.map((event) => (
                  <button
                    key={event.key}
                    aria-pressed={tournament === event.key}
                    onClick={() => setTournament(event.key)}
                  >
                    <EsportsImage
                      src={event.logo}
                      fallback={gameDef(event.game)?.logo}
                      name={event.name}
                    />
                    {event.name}
                  </button>
                ))}
              </div>
            )}
            <div className="ea-match-groups" aria-busy={busy}>
              {grouped.slice(0, 30).map(({ key, games }) => (
                <section key={key} className="ea-match-group">
                  <header>
                    <EsportsImage
                      src={games[0].event.logo}
                      fallback={gameDef(games[0].game)?.logo}
                      name={games[0].event.name}
                    />
                    <div>
                      <strong>{games[0].event.name}</strong>
                      <small>{gameDef(games[0].game)?.name}</small>
                    </div>
                    <span>
                      {new Date(games[0].startMs).toLocaleDateString(locale, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </header>
                  {games.slice(0, 40).map((item) => (
                    <EsportsMatchRow
                      key={item.id}
                      match={item}
                      onOpen={() => setMatch(item)}
                      onWatch={setStream}
                      onTeam={(team) => setSelectedTeam({ game: item.game, team })}
                    />
                  ))}
                </section>
              ))}
            </div>
            {busy && !mainMatches.length && (
              <div className="ea-skeletons" aria-label={t("Loading matches…")} role="status">
                {[0, 1, 2].map((index) => (
                  <div key={index}>
                    <i />
                    <span />
                    <i />
                  </div>
                ))}
              </div>
            )}
            {!busy && !filtered.length && (
              <div className="ea-empty">
                <CalendarDays size={28} />
                <h3>
                  {t(
                    search || tournament || date
                      ? "No matches for these filters"
                      : section === "results"
                        ? "No recent results reported"
                        : "No live or upcoming matches reported",
                  )}
                </h3>
                <p>
                  {t(
                    search || tournament || date
                      ? "Try another team, tournament or date."
                      : "The free feeds do not cover every competition. Explore the official schedule and broadcasts below.",
                  )}
                </p>
                {(search || tournament || date) && (
                  <button
                    className="sh-button"
                    onClick={() => {
                      setSearch("");
                      setTournament("");
                      setDate("");
                    }}
                  >
                    {t("Clear filters")}
                  </button>
                )}
              </div>
            )}
            <div className="ea-feed-health" role="status">
              {relevantFeeds.map((feed) => (
                <span key={feed!.game}>
                  <i className={feed!.status === "ready" ? "is-ready" : ""} />
                  {gameDef(feed!.game)?.shortName} ·{" "}
                  {t(
                    feed!.status === "ready"
                      ? "Updated"
                      : feed!.status === "stale"
                        ? "Saved schedule"
                        : "Official schedule available",
                  )}
                </span>
              ))}
              {busy && <span>{t("Updating schedules…")}</span>}
            </div>
            {!filtered.length && !busy && (
              <BroadcastTiles
                games={displayGames.slice(0, selected === "all" ? 4 : 1)}
                onWatch={setStream}
              />
            )}
          </>
        )}
        {section === "teams" && (
          <EsportsTeams
            selected={selected}
            teams={recentTeams}
            matches={matches}
            rankings={rankings}
            rankingsLoading={rankingsLoading}
            rankingsFailed={rankingsFailed}
            onTeam={setTeamId}
            onMatch={setMatch}
            loading={busy || teamsLoading}
            failed={teamsFailed}
            onRetry={() => setRetry((value) => value + 1)}
          />
        )}
        {section === "watch" && (
          <>
            <div className="ea-board-heading">
              <div>
                <h3>{t("The front row is yours")}</h3>
                <p>
                  {t(
                    "Official Twitch, YouTube and organizer broadcasts. No imported playlist needed.",
                  )}
                </p>
              </div>
            </div>
            <BroadcastTiles games={displayGames} onWatch={setStream} />
          </>
        )}
        {section === "matches" &&
          recentTeams.length > 0 &&
          (selected === "all" || selected === "dota2") && (
            <section className="ea-team-section">
              <div className="ea-board-heading">
                <div>
                  <h3>{t("Teams to know")}</h3>
                  <p>{t("Dota 2 · active teams, real records")}</p>
                </div>
                <button className="sh-button" onClick={() => changeSection("teams")}>
                  {t("All teams")}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="ea-team-rail" ref={teamsRail} {...teamsHandlers}>
                {recentTeams.slice(0, 8).map((team) => (
                  <button key={team.id} onClick={() => setTeamId(team.id)}>
                    <EsportsImage src={team.logo} name={team.name} />
                    <strong>{team.name}</strong>
                    <small>
                      {team.wins ?? "—"} {t("W")} · {team.losses ?? "—"} {t("L")}
                    </small>
                    <span>
                      {t("Players & stats")}
                      <ArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
      </div>
      <footer className="ea-attribution">
        <span>{t("Scores and schedules: Riot Games · OpenDota · Bo3.gg · BLAST.tv")}</span>
        <span>
          {t("Logos belong to their owners. Coverage and regional viewing availability vary.")}
        </span>
      </footer>
      <Suspense
        fallback={
          <div className="ea-modal-loading">
            <span className="ea-spinner" role="status" aria-label={t("Loading…")} />
          </div>
        }
      >
        {selectedTeam && (
          <TeamDialog
            selection={selectedTeam}
            matches={matches}
            onClose={() => setSelectedTeam(null)}
            onMatch={setMatch}
          />
        )}
        {eventPage && !match && !stream && teamId === null && !selectedTeam && (
          <EventPage
            event={eventPage}
            matches={matches}
            onClose={() => setEventPage(null)}
            onMatch={setMatch}
            onWatch={setStream}
          />
        )}
        {match && !stream && teamId === null && (
          <Match
            match={match}
            onClose={() => setMatch(null)}
            onWatch={setStream}
            onTeam={setTeamId}
          />
        )}{" "}
        {teamId !== null && !stream && <Team teamId={teamId} onClose={() => setTeamId(null)} />}
      </Suspense>
      {stream && (
        <EsportsBroadcast key={stream.url} stream={stream} onClose={() => {
          setStream(null);
          setMatch(null);
          setTeamId(null);
          setSelectedTeam(null);
          setEventPage(null);
        }} />
      )}
    </section>
  );
}
