import { createPortal } from "react-dom";
import { EsportsHero } from "./esports-hero";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Play, RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import type { EsportsFeed, EsportsMatch, EsportsTeam } from "@/lib/sports/esports-feeds";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import {
  esportsRailMatches,
  esportsRailGames,
  selectedEsportsFeeds,
} from "@/lib/sports/esports-match-rail";
import { useEsports } from "./use-esports";
import { EsportsGameLogo, EsportsImage } from "./esports-image";
import type { EsportsTeamSelection } from "./esports-team-dialog";
import "./esports-hub.css";
import "./esports-match-rail.css";

const Match = lazy(() => import("./esports-match").then((m) => ({ default: m.EsportsMatchView })));
const TeamDialog = lazy(() =>
  import("./esports-team-dialog").then((m) => ({ default: m.EsportsTeamDialog })),
);
const Team = lazy(() =>
  import("./esports-profile").then((m) => ({ default: m.EsportsTeamProfile })),
);
const Broadcast = lazy(() =>
  import("./esports-broadcast").then((m) => ({ default: m.EsportsBroadcast })),
);

function MatchCard({
  match,
  onOpen,
  onWatch,
  onTeam,
}: {
  match: EsportsMatch;
  onOpen: (match: EsportsMatch) => void;
  onTeam: (team: EsportsTeam) => void;
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const game = ESPORTS_GAMES.find((game) => game.id === match.game)!;
  const live = match.state === "live";
  const finished = match.state === "recent";
  const title = match.teams.map((team) => team.name).join(" · ");
  return (
    <article className={`emr-card ${live ? "is-live" : ""}`}>
      <div className="emr-open">
        <button
          className="emr-event-open"
          onClick={() => onOpen(match)}
          aria-label={`${t("Match center")} - ${title}`}
        />
        <span className="emr-card-head">
          <span className="emr-game" title={game.name}>
            <EsportsGameLogo game={game} />
            <span>{game.shortName}</span>
          </span>
          <span className={live ? "emr-live" : "emr-state"}>
            {live && <i />}
            {t(live ? "Live now" : finished ? "Final" : "Upcoming")}
          </span>
        </span>
        <span className="emr-event">
          {match.event.logo && <EsportsImage src={match.event.logo} name={match.event.name} />}
          <span title={match.event.name}>{match.event.name}</span>
        </span>
        <span className="emr-teams">
          {match.teams.map((team, i) => (
            <button
              className="emr-team ea-team-link"
              key={`${team.id}:${i}`}
              onClick={() => onTeam(team)}
              aria-label={`${t("View team profile")} · ${team.name}`}
            >
              <EsportsImage src={team.logo} name={team.name} />
              <strong>{team.name}</strong>
              <b className={team.winner ? "is-winner" : ""}>
                {match.state !== "upcoming" ? (team.score ?? "—") : ""}
              </b>
            </button>
          ))}
        </span>
        <span className="emr-match-meta">
          <span>
            {match.game === "dota2" && match.state !== "upcoming"
              ? t("Kills")
              : match.bestOf
                ? t("Best of {count}", { count: match.bestOf })
                : game.name}
            {match.event.stage && ` · ${match.event.stage}`}
          </span>
          {!live && (
            <time dateTime={new Date(match.startMs).toISOString()}>
              {new Date(match.startMs).toLocaleString(locale, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          )}
        </span>
        <span className="emr-open-label">
          {t("Match center")}
          <ArrowRight size={15} />
        </span>
      </div>
      {live && match.streams.length > 0 && (
        <button
          className="emr-watch"
          onClick={() => onWatch(match.streams[0])}
          aria-label={`${t("Watch broadcast")} · ${title}`}
        >
          <Play size={14} fill="currentColor" />
          {t("Watch")}
        </button>
      )}
    </article>
  );
}

export function EsportsMatchRailContent({
  matches,
  loading,
  unavailable,
  onOpen,
  onWatch,
  onExplore,
  onRetry,
  liveOnly = false,
}: {
  liveOnly?: boolean;
  matches: EsportsMatch[];
  loading: boolean;
  unavailable: boolean;
  onOpen: (match: EsportsMatch) => void;
  onWatch: (stream: EsportsStream) => void;
  onExplore: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  const [selectedTeam, setSelectedTeam] = useState<EsportsTeamSelection | null>(null);
  const live = matches.filter((match) => match.state === "live").length;
  const scroll = (direction: number) => {
    const rail = ref.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(320, rail.clientWidth * 0.8),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  return (
    <>
      <div className="sh-section-head emr-heading">
        <div>
          <h2>
            {t("Esports")}
            {live > 0 && (
              <span className="emr-live-count">
                <i />
                {t("{n} live", { n: live })}
              </span>
            )}
          </h2>
          {unavailable && <p>{t("Some schedules are unavailable")}</p>}
          {matches.length > 0 && matches.every((match) => match.state === "recent") && (
            <p>{t("Latest results")}</p>
          )}
        </div>
        <div className="emr-nav">
          <button className="sh-text-button" onClick={onExplore}>
            {t("All matches")}
            <ArrowRight size={15} />
          </button>
          {matches.length > 1 && (
            <>
              <button
                className="sh-icon"
                aria-label={t("Previous matches")}
                onClick={() => scroll(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button className="sh-icon" aria-label={t("Next matches")} onClick={() => scroll(1)}>
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
      {loading && !matches.length ? (
        <div className="emr-loading" role="status" aria-label={t("Loading matches…")}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <span />
              <b />
              <b />
              <span />
            </div>
          ))}
        </div>
      ) : matches.length ? (
        <div className="emr-rail" ref={ref} {...handlers}>
          {matches.map((match) => (
            <MatchCard
              key={`${match.game}:${match.id}`}
              match={match}
              onOpen={onOpen}
              onWatch={onWatch}
              onTeam={(team) => setSelectedTeam({ game: match.game, team })}
            />
          ))}
        </div>
      ) : (
        <div className="emr-empty">
          <p>
            {t(
              unavailable
                ? "Match schedules could not be loaded."
                : liveOnly
                  ? "No live esports matches right now."
                  : "No matches scheduled right now.",
            )}
          </p>
          {unavailable && (
            <button className="sh-button emr-retry" onClick={onRetry}>
              <RefreshCw size={15} />
              {t("Retry")}
            </button>
          )}
        </div>
      )}
      <Suspense fallback={null}>
        {selectedTeam && (
          <TeamDialog
            selection={selectedTeam}
            matches={matches}
            onClose={() => setSelectedTeam(null)}
            onMatch={(match) => {
              setSelectedTeam(null);
              onOpen(match);
            }}
          />
        )}
      </Suspense>
    </>
  );
}

export function EsportsMatchRail({
  heroTarget,
  active,
  refresh,
  onExplore,
  liveOnly = false,
  leagueKeys,
}: {
  heroTarget?: HTMLElement | null;
  liveOnly?: boolean;
  leagueKeys?: readonly string[];
  active: boolean;
  refresh: number;
  onExplore: () => void;
}) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const visible = useInViewport(root);
  const pageVisible = usePageVisible();
  const [retry, setRetry] = useState(0);
  const [match, setMatch] = useState<EsportsMatch | null>(null);
  const [stream, setStream] = useState<EsportsStream | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const games = esportsRailGames(leagueKeys);
  const feed = useEsports(
    "all",
    active && (visible || !!heroTarget) && pageVisible && !match && !stream && teamId === null,
    refresh + retry,
    { profiles: false, teamLogos: true, games },
  );
  const feeds = selectedEsportsFeeds(
    Object.values(feed.feeds).filter((item): item is EsportsFeed => !!item),
    leagueKeys,
  );
  const matches = useMemo(() => {
    const logoById = new Map(feed.teams.map((team) => [String(team.id), team.logo]));
    return esportsRailMatches(
      selectedEsportsFeeds(
        Object.values(feed.feeds).filter((item): item is EsportsFeed => !!item),
        leagueKeys,
      ),
      feed.now,
    ).map((match) =>
      match.game !== "dota2"
        ? match
        : {
            ...match,
            teams: match.teams.map((team) => ({
              ...team,
              logo: team.logo || logoById.get(team.id),
            })) as EsportsMatch["teams"],
          },
    );
  }, [feed.feeds, feed.now, feed.teams, leagueKeys]);
  return (
    <section className="sh-section emr-section" ref={root} aria-label={t("Esports")}>
      {heroTarget &&
        createPortal(
          <EsportsHero
            matches={matches}
            loading={feed.pending.length > 0}
            active={active && !match && !stream && teamId === null}
            onOpen={setMatch}
            onWatch={setStream}
            onExplore={onExplore}
          />,
          heroTarget,
        )}
      <EsportsMatchRailContent
        matches={liveOnly ? matches.filter((match) => match.state === "live") : matches}
        liveOnly={liveOnly}
        loading={
          (games === undefined || games.length > 0) &&
          (feed.pending.some((key) => games === undefined || games.some((game) => game === key)) ||
            !feeds.length)
        }
        unavailable={feeds.some((item) => item.status !== "ready")}
        onOpen={setMatch}
        onWatch={setStream}
        onExplore={onExplore}
        onRetry={() => setRetry((n) => n + 1)}
      />
      <Suspense
        fallback={
          <div className="ea-modal-loading">
            <span className="ea-spinner" role="status" aria-label={t("Loading…")} />
          </div>
        }
      >
        {match && !stream && teamId === null && (
          <Match
            match={match}
            onClose={() => setMatch(null)}
            onWatch={setStream}
            onTeam={setTeamId}
          />
        )}
        {teamId !== null && !stream && <Team teamId={teamId} onClose={() => setTeamId(null)} />}
        {stream && <Broadcast key={stream.url} stream={stream} onClose={() => {
          setStream(null);
          setMatch(null);
          setTeamId(null);
        }} />}
      </Suspense>
    </section>
  );
}
