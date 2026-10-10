import { useEffect, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { sportsJson, hubLeague } from "@/lib/sports/hub-data";
import {
  competitionSeed,
  loadCompetitionMetadata,
  readCompetitionMetadata,
  type CompetitionMetadata,
} from "@/lib/sports/competition-metadata";
import type { SportsGame } from "@/lib/sports/espn";
import { useEventDate } from "./hub-cards";
import { nascarSeriesForLeague } from "@/lib/sports/nascar-data";
import { NascarHub } from "./nascar-hub";
import { RacingVenue } from "./racing-venue";
import { motorsportOfficialWebsite } from "@/lib/sports/motorsport-catalog";
import { CompetitionAthletes } from "./competition-athletes";

export function HubCompetition({ game }: { game: SportsGame }) {
  return nascarSeriesForLeague(game.league) ? (
    <NascarHub
      key={`${game.league}:${game.id}`}
      game={game}
      fallback={<GenericCompetition game={game} />}
      venue={(race) => (
        <RacingVenue game={game} trackName={race.trackName} trackId={race.trackId} />
      )}
    />
  ) : (
    <GenericCompetition key={`${game.league}:${game.id}`} game={game} />
  );
}

function GenericCompetition({ game }: { game: SportsGame }) {
  const t = useT();
  const date = useEventDate();
  const def = hubLeague(game.league);
  const key = `${game.league}:${game.id}:${game.startMs}`;
  const [state, setState] = useState<{
    key: string;
    detail: CompetitionMetadata;
    status: string;
  }>(() => ({
    key,
    detail: (def && readCompetitionMetadata(game, def)) || competitionSeed(game, def),
    status: "loading",
  }));
  const [retry, setRetry] = useState(0);
  const detail =
    state.key === key
      ? state.detail
      : (def && readCompetitionMetadata(game, def)) || competitionSeed(game, def);
  const status = state.key === key ? state.status : "loading";

  useEffect(() => {
    if (!def) return;
    const controller = new AbortController();
    // Keep the last event details visible throughout a refresh.
    setState((prior) => ({
      key,
      detail:
        prior.key === key
          ? prior.detail
          : readCompetitionMetadata(game, def) || competitionSeed(game, def),
      status: "loading",
    }));
    void loadCompetitionMetadata(game, def, controller.signal, sportsJson, retry > 0)
      .then((result) => {
        if (!controller.signal.aborted) setState({ key, detail: result, status: "ready" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState((prior) => ({ ...prior, status: "error" }));
      });
    return () => controller.abort();
  }, [key, retry]);

  const venue = detail.venue;
  const website = detail.website || motorsportOfficialWebsite(game.league);
  return (
    <section className="min-w-0">
      <RacingVenue game={game} />
      <h3>{t("Event schedule")}</h3>
      <div className="sh-race-sessions" aria-busy={status === "loading"}>
        {detail.sessions.map((session) => (
          <div key={session.id}>
            <strong>{session.name}</strong>
            <span>{date(session.startMs)}</span>
            <small>{session.status}</small>
          </div>
        ))}
      </div>
      {status === "loading" && (
        <p role="status" className="text-xs text-ink-subtle">
          {t("Loading event schedule…")}
        </p>
      )}
      {status === "error" && (
        <div className="sh-feed-note">
          <span>{t("The event schedule is unavailable.")}</span>
          <button className="sh-text-button" onClick={() => setRetry((n) => n + 1)}>
            {t("Retry")}
          </button>
        </div>
      )}

      {detail.source === "thesportsdb" && venue && (
        <div className="mt-5 overflow-hidden rounded-xl bg-canvas">
          {venue.image && (
            <img
              key={venue.image}
              src={venue.image}
              alt={venue.name}
              loading="lazy"
              decoding="async"
              className="h-44 w-full object-cover sm:h-52"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          <div className="flex flex-wrap items-center gap-3 p-4">
            <MapPin size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <strong className="text-sm">{venue.name}</strong>
              {venue.location && (
                <p className="m-0 mt-1 text-xs text-ink-muted">{venue.location}</p>
              )}
            </div>
            {venue.website && (
              <button
                className="sh-text-button inline-flex min-h-10 items-center gap-2"
                onClick={() => openUrl(venue.website!)}
              >
                {t("Venue website")}
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {detail.description && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer py-3 font-semibold">{t("Event details")}</summary>
          <p className="whitespace-pre-line break-words leading-relaxed text-ink-muted">
            {detail.description}
          </p>
        </details>
      )}

      <h3 className="sh-field-title">{t(detail.results ? "Results" : "The field")}</h3>
      {detail.entrants.length > 0 ? (
        <div className="sh-race-sessions sh-competition-field">
          {detail.entrants.map((entrant) => (
            <div key={entrant.id}>
              {entrant.position != null && (
                <span className="w-6 shrink-0 tabular-nums">{entrant.position}</span>
              )}
              <strong className="min-w-0 break-words">
                <CompetitionAthletes
                  name={entrant.name}
                  athletes={entrant.athletes}
                  league={game.league}
                  group={def?.group ?? ""}
                />
                {entrant.team && <small className="mt-1 block font-normal">{entrant.team}</small>}
              </strong>
              <span className="tabular-nums">{entrant.result}</span>
            </div>
          ))}
        </div>
      ) : detail.resultText ? (
        <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">
          {detail.resultText}
        </p>
      ) : (
        <p>
          {t(
            game.state === "post"
              ? "Results are not available yet."
              : "Entrants and starting positions appear when the feed publishes them.",
          )}
        </p>
      )}

      {(website || detail.sourceUrl) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {website && (
            <button
              className="sh-text-button inline-flex min-h-10 items-center gap-2"
              onClick={() => openUrl(website)}
            >
              {t("Competition website")}
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          )}
          {detail.sourceUrl && (
            <button
              className="sh-text-button inline-flex min-h-10 items-center gap-2"
              onClick={() => openUrl(detail.sourceUrl!)}
            >
              TheSportsDB
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
