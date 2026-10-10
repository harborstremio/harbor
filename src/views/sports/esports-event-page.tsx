import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ExternalLink, MapPin, Play, Trophy, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import { currentEsportsMatches, type EsportsMatch } from "@/lib/sports/esports-feeds";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import { matchEsportsSeries } from "@/lib/sports/esports-series";
import { esportsEventGameArt } from "@/lib/sports/esports-event-media";
import { EsportsImage } from "./esports-image";
import {
  EsportsEventMedia,
  EsportsEventPrizes,
  EsportsEventStages,
} from "./esports-event-sections";
import { useEsportsEventDetail } from "./use-esports-event";
import {
  esportsEventDateRange,
  esportsPrizeLabel,
  type EsportsEventSummary,
} from "./esports-event-model";
import "./esports-event-page.css";

const gameDef = (id: string) => ESPORTS_GAMES.find((game) => game.id === id);

function HeroArt({ sources }: { sources: string[] }) {
  const [step, setStep] = useState(0);
  const src = sources[step];
  if (!src) return null;
  return (
    <img
      className="eev-hero-art"
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setStep((value) => value + 1)}
    />
  );
}

/** Scores keep team order in Arabic, so every composed numeric run carries its own direction. */
export function EsportsEventMatch({
  match,
  onOpen,
  onWatch,
}: {
  match: EsportsMatch;
  onOpen: () => void;
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const scored = match.state !== "upcoming";
  return (
    <article className={`eev-match ${match.state === "live" ? "is-live" : ""}`}>
      <button className="eev-match-open" onClick={onOpen} aria-label={t("Match center")}>
        <span className="eev-match-when">
          {match.state === "live" ? (
            <b className="ea-live">
              <i />
              {t("Live")}
            </b>
          ) : (
            <b>
              {new Date(match.startMs).toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </b>
          )}
          {match.event.stage && <small>{match.event.stage}</small>}
        </span>
        <span className="eev-match-teams">
          {match.teams.map((team, index) => (
            <span className="eev-match-team" key={`${team.id || team.name}-${index}`}>
              <EsportsImage src={team.logo} name={team.name} />
              <strong>{team.name}</strong>
              {scored && team.score !== undefined && <b dir="ltr">{team.score}</b>}
            </span>
          ))}
        </span>
      </button>
      {match.streams[0] && match.state !== "recent" && (
        <button
          className="eev-match-watch"
          onClick={() => onWatch(match.streams[0])}
          aria-label={t("Watch broadcast")}
        >
          <Play size={14} aria-hidden="true" />
          {t("Watch")}
        </button>
      )}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="eev-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The tournament above a single match: who is competing, where it is played, what it pays, and the
 * stages the keyless sources can actually describe. Partial data is the normal case, so a section
 * with nothing behind it is absent rather than empty, and no bracket is ever drawn from stubs.
 */
export function EsportsEventPage({
  event,
  matches,
  onClose,
  onMatch,
  onWatch,
}: {
  event: EsportsEventSummary;
  matches: EsportsMatch[];
  onClose: () => void;
  onMatch: (match: EsportsMatch) => void;
  onWatch: (stream: EsportsStream) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const def = gameDef(event.game);
  const series = useMemo(
    () => matchEsportsSeries(event.name, event.game),
    [event.name, event.game],
  );
  const detail = useEsportsEventDetail(event, series);
  const own = useMemo(
    () =>
      matches.filter(
        (match) => match.game === event.game && event.eventIds.includes(match.event.id),
      ),
    [matches, event.game, event.eventIds],
  );
  const live = useMemo(
    () => currentEsportsMatches(own).filter((match) => match.state === "live"),
    [own],
  );
  useEffect(() => {
    close.current?.focus();
    return () => {
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
  }, []);

  const league = detail.league;
  const range = esportsEventDateRange(
    league?.startMs ?? event.startMs,
    league?.endMs ?? event.endMs,
    locale,
    true,
  );
  const city = league?.city ?? event.location?.city;
  const country = league?.country ?? event.location?.country;
  const where = [city, country].filter(Boolean).join(", ");
  const prize = league?.prizePoolUsd
    ? esportsPrizeLabel(league.prizePoolUsd, "USD", locale)
    : esportsPrizeLabel(event.prize?.totalUsd, event.prizeCurrency, locale);
  const art = esportsEventGameArt(event.game);
  const heroSources = [detail.hero?.photo?.url, art.url, art.fallback].filter(
    (value): value is string => !!value,
  );
  const venueUrl = league?.venue?.url;
  const credit = detail.credit;
  const provider = event.sourceUrl;
  const next = own.find((match) => match.state === "upcoming");
  const broadcast = def?.broadcasts[0];
  const action = live[0]?.streams[0]
    ? { label: t("Watch now"), run: () => onWatch(live[0].streams[0]) }
    : live[0]
      ? { label: t("Match center"), run: () => onMatch(live[0]) }
      : next
        ? { label: t("Match center"), run: () => onMatch(next) }
        : broadcast
          ? { label: t("Official channels"), run: () => onWatch(broadcast) }
          : undefined;
  const facts: { key: string; label: string; value: string }[] = [];
  if (range) facts.push({ key: "date", label: t("Date"), value: range });
  if (where) facts.push({ key: "where", label: t("Location"), value: where });
  if (league?.venue?.label)
    facts.push({ key: "venue", label: t("Venue"), value: league.venue.label });
  if (league?.organisers.length)
    facts.push({ key: "host", label: t("Host"), value: league.organisers.join(", ") });
  if (prize) facts.push({ key: "prize", label: t("Prize pool"), value: prize });
  if (league?.format) facts.push({ key: "format", label: t("Format"), value: league.format });
  if (league?.teamCount)
    facts.push({ key: "count", label: t("Teams"), value: String(league.teamCount) });

  return (
    <ModalShell closing={false} onDismiss={onClose} labelledBy={titleId} width={1100}>
      <div className="eev-page">
        <header className="eev-hero">
          <HeroArt key={heroSources[0]} sources={heroSources} />
          <button
            ref={close}
            className="eev-hero-close sh-icon"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
          <div className="eev-hero-copy">
            <div className="eev-hero-identity">
              {detail.hero?.logo && !detail.hero.photo && (
                <EsportsImage
                  src={detail.hero.logo.url}
                  name={event.name}
                  className="eev-hero-logo"
                />
              )}
              <div>
                <span className="ea-kicker">{(series?.name ?? def?.name ?? "").toUpperCase()}</span>
                <h2 id={titleId}>{event.name}</h2>
              </div>
            </div>
            <p className="eev-hero-meta">
              {range && (
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {range}
                </span>
              )}
              {where && (
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {where}
                </span>
              )}
              {prize && (
                <span>
                  <Trophy size={14} aria-hidden="true" />
                  {prize}
                </span>
              )}
              {event.tierChip && <b className="eev-chip eev-chip-tier">{event.tierChip}</b>}
            </p>
            {event.teams.length > 0 && (
              <div className="eev-hero-teams">
                {event.teams.slice(0, 8).map((team) => (
                  <EsportsImage key={team.id || team.name} src={team.logo} name={team.name} />
                ))}
                {event.teams.length > 8 && <small>{`+${event.teams.length - 8}`}</small>}
              </div>
            )}
            {action && (
              <button className="eev-hero-action" onClick={action.run}>
                <Play size={15} aria-hidden="true" />
                {action.label}
              </button>
            )}
          </div>
          {detail.hero && detail.hero.credits.length > 0 && (
            <small className="eev-hero-credit">{detail.hero.credits.join(" · ")}</small>
          )}
        </header>
        <div className="eev-body">
          {live.length > 0 && (
            <section className="eev-section">
              <h3>
                <b className="ea-live">
                  <i />
                  {t("Live now")}
                </b>
              </h3>
              <div className="eev-matches">
                {live.map((match) => (
                  <EsportsEventMatch
                    key={match.id}
                    match={match}
                    onOpen={() => onMatch(match)}
                    onWatch={onWatch}
                  />
                ))}
              </div>
            </section>
          )}
          {facts.length > 0 && (
            <section className="eev-section">
              <h3>{t("Overview")}</h3>
              <dl className="eev-facts">
                {facts.map((fact) => (
                  <Fact key={fact.key} label={fact.label}>
                    {fact.key === "venue" && venueUrl ? (
                      <button className="eev-link" onClick={() => openUrl(venueUrl)}>
                        {fact.value}
                        <ExternalLink size={13} aria-hidden="true" />
                      </button>
                    ) : (
                      fact.value
                    )}
                  </Fact>
                ))}
              </dl>
            </section>
          )}
          <section className="eev-section">
            <h3>
              {t("Teams")}
              {event.teams.length > 0 && (
                <small>{t("{count} competing", { count: event.teams.length })}</small>
              )}
            </h3>
            {event.teams.length > 0 ? (
              <div className="eev-teams">
                {event.teams.map((team) => (
                  <span className="eev-team" key={team.id || team.name}>
                    <EsportsImage src={team.logo} name={team.name} />
                    <strong>{team.name}</strong>
                  </span>
                ))}
              </div>
            ) : (
              <p className="eev-empty">
                {t("Teams will appear when this competition announces its participants.")}
              </p>
            )}
          </section>
          <EsportsEventStages
            matches={own}
            detail={detail}
            renderMatch={(match) => (
              <EsportsEventMatch
                key={match.id}
                match={match}
                onOpen={() => onMatch(match)}
                onWatch={onWatch}
              />
            )}
          />
          <EsportsEventMedia detail={detail} />
          <EsportsEventPrizes detail={detail} />
          {def && def.broadcasts.length > 0 && (
            <section className="eev-section">
              <h3>{t("Where to watch")}</h3>
              <div className="eev-watch">
                {def.broadcasts.map((stream) => (
                  <button key={stream.url} onClick={() => onWatch(stream)}>
                    <Play size={14} aria-hidden="true" />
                    {stream.title}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="eev-section eev-sources">
            <h3>{t("Sources")}</h3>
            <ul>
              {credit && (
                <li>
                  <button className="eev-link" onClick={() => openUrl(credit.pageUrl)}>
                    {`${t("Source")}: ${credit.source} (${credit.licence})`}
                    <ExternalLink size={13} aria-hidden="true" />
                  </button>
                </li>
              )}
              {provider && (
                <li>
                  <button className="eev-link" onClick={() => openUrl(provider)}>
                    {t("Provider")}
                    <ExternalLink size={13} aria-hidden="true" />
                  </button>
                </li>
              )}
              {detail.hero?.credits.map((line) => <li key={line}>{line}</li>)}
              <li>
                {t(
                  "Logos belong to their owners. Coverage and regional viewing availability vary.",
                )}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </ModalShell>
  );
}
