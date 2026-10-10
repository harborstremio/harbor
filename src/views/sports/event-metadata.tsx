import { ScoreMetric, ScoreBreakdown } from "./score-breakdown";
import { TeamProfileLink, teamIdentity } from "./team-profile-link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, MapPin, Play } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { LeagueDef, SportsGame } from "@/lib/sports/espn";
import {
  loadPublishedEvent,
  readPublishedEvent,
  type PublishedEvent,
} from "@/lib/sports/event-enrichment";
import { EventLogo } from "./hub-cards";
import { parseCompetitionResultText } from "@/lib/sports/competition-metadata";
import { CompetitionAthletes } from "./competition-athletes";
import "./event-metadata.css";

/** Selected event details; only individual results request a supplementary athlete classification. */
export function EventMetadata({ game, league }: { game: SportsGame; league: LeagueDef }) {
  const t = useT();
  const [data, setData] = useState<PublishedEvent | undefined>(() =>
    readPublishedEvent(game, league),
  );
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [failedImage, setFailedImage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void loadPublishedEvent(game, league, controller.signal, undefined, retry > 0)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result) setData(result);
        setStatus(result ? "ready" : "empty");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [game.id, league.key, retry]);
  const current =
    data?.game.id === game.id && data.game.league === game.league ? data : undefined;
  const event = current?.game || game;
  const artwork = event.artwork || current?.banner || current?.square || event.poster;
  const classification = useMemo(
    () => current?.entrants ?? parseCompetitionResultText(current?.resultText),
    [current?.entrants, current?.resultText],
  );
  const hasScore = event.home.score !== "" && event.away.score !== "";
  const venue = current?.venue?.name || event.context?.venue;
  return (
    <section className="sh-published-event">
      {artwork && failedImage !== artwork && (
        <img
          className="sh-published-event-art"
          src={artwork}
          alt=""
          decoding="async"
          onError={() => setFailedImage(artwork)}
        />
      )}
      {event.away.name && (
        <div className="sh-published-score">
          <TeamProfileLink team={teamIdentity(event, "home")} className="sh-team-detail-link">
            <EventLogo side={event.home} fallback={league.logo} sport={league.group} />
            <strong>{event.home.name}</strong>
          </TeamProfileLink>
          <span>
            <ScoreMetric sport={league.group} game={event} />
            {hasScore ? `${event.home.score} : ${event.away.score}` : t("VS")}
            <small>{event.state === "post" ? t("Final") : t("Scheduled")}</small>
          </span>
          <TeamProfileLink team={teamIdentity(event, "away")} className="sh-team-detail-link">
            <EventLogo side={event.away} fallback={league.logo} sport={league.group} />
            <strong>{event.away.name}</strong>
          </TeamProfileLink>
        </div>
      )}
      <ScoreBreakdown game={event} sport={league.group} />
      <div className="sh-published-event-facts">
        {venue && (
          <span>
            <MapPin size={15} />
            {venue}
          </span>
        )}
        {current?.season && (
          <span>
            {t("Season")} {current.season}
          </span>
        )}
        {current?.round && (
          <span>
            {t("Round")} {current.round}
          </span>
        )}
      </div>
      {current?.description && <p className="sh-published-description">{current.description}</p>}
      {classification.length > 0 ? (
        <div className="sh-published-classification">
          <h4>{t("Results")}</h4>
          <ol>
            {classification.map((entrant) => (
              <li key={entrant.id}>
                <span>{entrant.position}</span>
                <strong>
                  <CompetitionAthletes
                    name={entrant.name}
                    athletes={entrant.athletes}
                    league={game.league}
                    group={league.group}
                  />
                </strong>
                {entrant.team && <em>{entrant.team}</em>}
                <b>{entrant.result}</b>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        current?.resultText && <p className="sh-published-description">{current.resultText}</p>
      )}
      {status === "loading" && (
        <div className="sh-published-state" role="status">
          <LoaderCircle size={17} className="animate-spin" />
          {t("Loading event details…")}
        </div>
      )}
      {status === "error" && (
        <div className="sh-feed-note">
          <span>{t("Event details are unavailable right now.")}</span>
          <button className="sh-text-button" onClick={() => setRetry((value) => value + 1)}>
            {t("Retry")}
          </button>
        </div>
      )}
      <div className="sh-published-links">
        {current?.videoUrl && (
          <button className="sh-button" onClick={() => openUrl(current.videoUrl!)}>
            <Play size={15} />
            {t("View video")}
            <ArrowUpRight size={14} />
          </button>
        )}
        {current?.sourceUrl && (
          <button className="sh-text-button" onClick={() => openUrl(current.sourceUrl)}>
            {t("Event source")}
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <p className="sh-published-note">
        {t(
          "Published schedule and results from TheSportsDB. Live tracking is not provided by this feed.",
        )}
      </p>
    </section>
  );
}
