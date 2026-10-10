import { Play } from "@/components/icons/play-filled";
import { LEAGUE_LOGO_FALLBACKS } from "@/lib/sports/league-branding";
import { racingVenue } from "@/lib/sports/racing-venues";
import { isSetSport } from "@/lib/sports/score-detail";
import { LeagueLogo } from "./league-logo";
import { useEventVenuePhoto } from "./use-event-venue-photo";
import { SportsHeroScenery } from "./sports-hero-scenery";
import { useRef, useState } from "react";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Trophy,
  Tv,
  Clock3,
} from "lucide-react";

import { useT, useUiLanguage } from "@/lib/i18n";

import { getLeagueLabel, type SportsGame, type SportsSide } from "@/lib/sports/espn";

import { hubLeague } from "@/lib/sports/hub-data";

import { gameKey } from "@/lib/sports/hub-cache";

import { useInViewport } from "@/lib/visibility";

import { useDragScroll } from "@/lib/use-drag-scroll";

import { SportIcon } from "./sport-icon";

import { useSportsArtwork } from "./use-artwork";

import "./hub-art-motion.css";

import { matchCardContext, relativeCardStart } from "@/lib/sports/card-context";

import { formatSportsEventDate } from "@/lib/sports/event-date";

import "./card-context.css";

import { TeamProfileLink, teamIdentity } from "./team-profile-link";

import "./team-links.css";

export function EventLogo(props: {
  side: SportsSide;

  large?: boolean;

  fallback?: string;

  sport?: string;
}) {
  return (
    <EventLogoImage
      key={`${props.side.logo ?? ""}|${props.fallback ?? ""}`}

      {...props}
    />
  );
}

function EventLogoImage({
  side,

  large = false,

  fallback,

  sport = "trophy",
}: {
  side: SportsSide;

  large?: boolean;

  fallback?: string;

  sport?: string;
}) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const [loaded, setLoaded] = useState("");

  const logo = [side.logo, fallback, LEAGUE_LOGO_FALLBACKS[fallback || side.logo || ""]].find(
    (candidate): candidate is string => !!candidate && !failed.has(candidate),
  );

  const fallbackActive = !logo || logo !== side.logo;

  return (
    <span
      className={`sh-team-logo ${large ? "large" : ""}`}

      data-logo-fallback={fallbackActive}

      data-logo-loading={!!logo && loaded !== logo}
    >
      {logo ? (
        <img
          key={logo}

          src={logo}

          alt=""

          draggable={false}

          loading={large ? "eager" : "lazy"}

          decoding="async"

          onLoad={() => setLoaded(logo)}

          onError={() => setFailed((current) => new Set(current).add(logo))}
        />
      ) : (
        <SportIcon name={sport} size={large ? 96 : 24} />
      )}
    </span>
  );
}

export function useEventDate() {
  const locale = useUiLanguage();

  const t = useT();

  return (ms: number, short = false, dateOnly?: string) => {
    const date = formatSportsEventDate(ms, locale, short, dateOnly);

    return dateOnly !== undefined ? [date, t("Time TBA")].filter(Boolean).join(" · ") : date;
  };
}

export function HubCard({
  game,

  onOpen,

  stale = false,
}: {
  game: SportsGame;

  onOpen: (g: SportsGame) => void;

  stale?: boolean;
}) {
  stale = game.savedAt !== undefined;

  const t = useT();

  const date = useEventDate();

  const locale = useUiLanguage();

  const league = hubLeague(game.league);

  const event =
    !!game.context?.name &&
    (!game.away.name ||
      ["combat", "boxing", "esports", "golf", "motorsport"].includes(league?.group ?? ""));

  const setSport = isSetSport(league?.group);
  const context = matchCardContext(game).filter(
    (row) =>
      !event ||
      (row.kind !== "start" &&
        !(
          row.kind === "stage" &&
          (game.context?.name ?? "").toLowerCase().includes(row.value.toLowerCase())
        )),
  );

  const sparse =
    !event &&
    !game.home.record &&
    !game.away.record &&
    context.every((row) => row.kind === "start");

  const root = useRef<HTMLElement>(null);

  const visible = useInViewport(root, false);

  const raceVenue = game ? racingVenue(game) : null;
  const venuePhoto = useEventVenuePhoto(game, visible);
  const art = useSportsArtwork(event && visible && !venuePhoto ? game : undefined);

  const [broken, setBroken] = useState<string[]>([]);
  const eventImage = [venuePhoto?.photo, game.artwork, game.poster].find(
    (url): url is string => !!url && !broken.includes(url),
  );

  return (
    <article
      ref={root}

      className={`sh-event-card ${event ? "is-event" : "is-team-card"} ${sparse ? "is-context-sparse" : ""}`}
    >
      <button
        className="sh-event-open"
        onClick={() => onOpen(game)}
        aria-label={`${t("Match center")} · ${game.context?.name || `${game.away.name} · ${game.home.name}`}`}
      />

      <span className="sh-card-meta">
        <span>{league ? getLeagueLabel(league) : game.league}</span>

        <span className={game.state === "in" && !stale ? "sh-live" : ""}>
          {stale
            ? t("Saved")
            : game.state === "in"
              ? t("Live")
              : game.state === "post"
                ? t("Final")
                : ""}
        </span>
      </span>

      {event ? (
        <>
          <span className="sh-event-art">
            {!["combat", "boxing"].includes(league?.group || "") && (
              <SportsHeroScenery league={game?.league} sport={league?.group} priority={false} />
            )}

            {eventImage ? (
              <img
                className="sh-card-artwork"

                src={eventImage}

                alt=""

                loading="lazy"

                onError={() => setBroken((prior) => [...prior, eventImage])}
              />
            ) : (league?.group === "combat" || league?.group === "boxing") &&
              (art.home || game.home.logo || art.away || game.away.logo) ? (
              <span className="sh-card-fighters">
                <EventLogo
                  side={{ ...game.home, logo: art.home || game.home.logo }}

                  fallback={league?.logo}

                  sport={league?.group}
                />

                <EventLogo
                  side={{ ...game.away, logo: art.away || game.away.logo }}

                  fallback={league?.logo}

                  sport={league?.group}
                />
              </span>
            ) : (
              <EventLogo
                side={{ ...game.home, logo: raceVenue?.logo || league?.logo || "" }}
                fallback={league?.logo}

                large

                sport={league?.group}
              />
            )}
          </span>

          <strong className="sh-event-title">{game.context!.name}</strong>

          <span className="sh-card-sub">
            {game.home.name} {game.away.name ? `· ${game.away.name}` : ""}
          </span>

          {(game.home.record || game.away.record) && (
            <span className="sh-card-records">
              <span className="sr-only">{t("Overall Record")}: </span>
              {game.home.record || "—"}
              {game.away.name ? ` · ${game.away.record || "—"}` : ""}
            </span>
          )}
        </>
      ) : (
        <span className="sh-card-teams">
          {[game.away, game.home].map((side, i) => (
            <span key={i}>
              <TeamProfileLink team={teamIdentity(game, side)} className="sh-card-team-link">
                <EventLogo
                  side={side}

                  fallback={league?.logo}

                  sport={league?.group}
                />

                <span className="sh-card-team-copy">
                  <strong>
                    {side.rank && <span className="sh-card-rank">#{side.rank}</span>}

                    {setSport && side.serving && (
                      <span className="sh-card-serving" aria-label={t("Serving")} />
                    )}

                    {side.name}
                  </strong>

                  {side.record && (
                    <small title={t("Overall Record")}>
                      <span className="sr-only">{t("Overall Record")}: </span>
                      {side.record}
                    </small>
                  )}

                  {setSport && side.periods?.length ? (
                    <span className="sh-card-sets">
                      {side.periods.map((entry) => (
                        <b key={entry.period} data-won={entry.winner || undefined}>
                          {entry.value}
                          {entry.tiebreak && <sup>{entry.tiebreak}</sup>}
                        </b>
                      ))}

                      {side.currentPoint && <em>{side.currentPoint}</em>}
                    </span>
                  ) : null}
                </span>
              </TeamProfileLink>

              {game.state !== "pre" && <b>{side.score}</b>}
            </span>
          ))}
        </span>
      )}

      {context.length > 0 && (
        <span className="sh-card-context">
          {context.map((row) => (
            <span key={row.kind} title={row.kind === "start" ? date(row.value) : row.value}>
              {row.kind === "venue" ? (
                <MapPin size={14} aria-label={t("Venue")} />
              ) : row.kind === "stage" ? (
                <Trophy size={14} aria-label={t("Round")} />
              ) : row.kind === "broadcast" ? (
                <Tv size={14} aria-label={t("Where to watch")} />
              ) : (
                <Clock3 size={14} aria-hidden="true" />
              )}

              <span>{row.kind === "start" ? relativeCardStart(row.value, locale) : row.value}</span>
            </span>
          ))}
        </span>
      )}

      <span className="sh-card-bottom">
        <span>
          {game.state === "in" && !stale ? game.detail : date(game.startMs, true, game.dateOnly)}
        </span>

        <ArrowRight size={16} />
      </span>
    </article>
  );
}

export function HubRow({
  title,

  description,

  games,

  onOpen,

  stale = false,
}: {
  title: string;

  description?: string;

  games: SportsGame[];

  onOpen: (g: SportsGame) => void;

  stale?: boolean;
}) {
  const t = useT();

  const { ref: rail, handlers } = useDragScroll<HTMLDivElement>();

  if (!games.length) return null;

  return (
    <section className="sh-section">
      <div className="sh-section-head">
        <div>
          <h2>
            {title === "Fight nights" && <SportIcon name="combat" size={24} />} {title}
            <span>{Math.min(games.length, 36)}</span>
          </h2>

          {description && <p>{description}</p>}
        </div>

        <div className="sh-row-arrows">
          <button
            className="sh-icon"

            aria-label={t("Scroll left")}

            onClick={() =>
              rail.current?.scrollBy({
                left: -rail.current.clientWidth * 0.8,

                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            <ChevronLeft size={20} />
          </button>

          <button
            className="sh-icon"

            aria-label={t("Scroll right")}

            onClick={() =>
              rail.current?.scrollBy({
                left: rail.current.clientWidth * 0.8,

                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        className="sh-event-rail"
        ref={rail}
        role="region"
        aria-label={title}
        tabIndex={0}
        {...handlers}
      >
        {games.slice(0, 36).map((g) => (
          <HubCard key={gameKey(g)} game={g} onOpen={onOpen} stale={stale} />
        ))}
      </div>
    </section>
  );
}

export function HubHero({
  game,

  onOpen,

  onCustomize,

  loading,

  stale,
}: {
  game?: SportsGame;

  onOpen: (g: SportsGame) => void;

  onCustomize: () => void;

  loading: boolean;

  stale: boolean;
}) {
  const t = useT();

  const date = useEventDate();

  const league = game ? hubLeague(game.league) : undefined;

  stale = game?.savedAt !== undefined;

  const raceVenue = game ? racingVenue(game) : null;
  const venuePhoto = useEventVenuePhoto(game);
  const art = useSportsArtwork(venuePhoto ? undefined : game);

  const [backdropReady, setBackdropReady] = useState("");

  const [backdropFailed, setBackdropFailed] = useState<string[]>([]);

  const backdrop = [venuePhoto?.photo, game?.artwork, game?.poster].find(
    (url): url is string => !!url && !backdropFailed.includes(url),
  );

  const showBackdrop = !!backdrop && backdropReady === backdrop;

  const combat = league?.group === "combat" || league?.group === "boxing";

  const race = league?.group === "motorsport" || league?.group === "golf";

  const homeLogo = art.home || game?.home.logo;

  const awayLogo = art.away || game?.away.logo;

  const promotionOnly = race || (combat && !homeLogo && !awayLogo);

  if (!game && loading)
    return (
      <section
        className="sh-hero sh-hero-skeleton"

        aria-label={t("Loading schedules…")}

        role="status"
      >
        <div>
          <i />

          <i />

          <i />

          <i />
        </div>

        <span />
      </section>
    );

  // The title wraps per side, so the longest single name drives whether it still fits.
  const heroTitleLength = game
    ? (game.context?.name ?? "").length || Math.max(game.away.name.length, game.home.name.length)
    : 0;
  return (
    <section
      className={`sh-hero has-backdrop ${combat ? "is-combat" : ""}`}

      aria-label={t("Featured event")}
    >
      {!backdrop && <SportsHeroScenery league={game?.league} sport={league?.group} />}
      {backdrop && (
        <img
          key={backdrop}

          className="sh-hero-backdrop"

          data-ready={showBackdrop}

          src={backdrop}

          alt=""

          draggable={false}

          decoding="async"

          fetchPriority="high"

          onLoad={() => setBackdropReady(backdrop)}

          onError={() => setBackdropFailed((prior) => [...prior, backdrop])}
        />
      )}

      <div className="sh-hero-copy" data-long={heroTitleLength > 17 || undefined} data-longest={heroTitleLength > 24 || undefined}>
        <div className="sh-hero-kicker">
          {game?.state === "in" && !stale ? (
            <span className="sh-live">{t("Live now")}</span>
          ) : (
            <span>{t("On the radar")}</span>
          )}

          {raceVenue && league && <LeagueLogo league={league} size={40} />}

          <span>{league ? getLeagueLabel(league) : t("Your sports. Your schedule.")}</span>
        </div>

        <h2>
          {game
            ? game.context?.name || (
                <>
                  <TeamProfileLink team={teamIdentity(game, "away")}>
                    {game.away.name}
                  </TeamProfileLink>

                  <span className="sh-vs">{t("vs")}</span>

                  <TeamProfileLink team={teamIdentity(game, "home")}>
                    {game.home.name}
                  </TeamProfileLink>
                </>
              )
            : t(loading ? "Finding the next big moment…" : "Schedules are taking a timeout")}
        </h2>

        {game ? (
          <p>
            {date(game.startMs, false, game.dateOnly)}

            {game.context?.venue ? ` · ${game.context.venue}` : ""}
          </p>
        ) : (
          <p>{t("Follow your teams. Find the next big event. Make a night of it.")}</p>
        )}

        <div className="sh-hero-actions">
          <button
            className="sh-button primary"

            onClick={() => (game ? onOpen(game) : onCustomize())}
          >
            {t(game ? "Explore event" : "Choose your sports")}

            {game ? <Play size={18} /> : <ArrowRight size={18} />}
          </button>

          {game && (
            <span className="sh-hero-hint">
              {stale
                ? t("Saved schedule")
                : combat
                  ? t("Fight card & match details")
                  : t("Match details & available streams")}
            </span>
          )}
        </div>

        {!game && loading && (
          <span className="sh-loading-note" role="status">
            {t("Finding your next great match…")}
          </span>
        )}
      </div>

      <div className={`sh-hero-art ${promotionOnly ? "sh-hero-promotion" : ""}`}>
        {game ? (
          <>
            <span className="sh-hero-watermark">{game.league}</span>

            {promotionOnly ? (
              <EventLogo
                side={{ ...game.home, logo: raceVenue?.logo || league?.logo || "" }}
                fallback={league?.logo}

                large

                sport={league?.group}
              />
            ) : (
              (!showBackdrop || !combat) && (
                <>
                  <TeamProfileLink team={teamIdentity(game, "away")} className="sh-hero-team-link">
                    <EventLogo
                      side={{ ...game.away, logo: awayLogo || "" }}

                      large

                      fallback={league?.logo}

                      sport={league?.group}
                    />
                  </TeamProfileLink>

                  <span className="sh-hero-slash">/</span>

                  <TeamProfileLink team={teamIdentity(game, "home")} className="sh-hero-team-link">
                    <EventLogo
                      side={{ ...game.home, logo: homeLogo || "" }}

                      large

                      fallback={league?.logo}

                      sport={league?.group}
                    />
                  </TeamProfileLink>
                </>
              )
            )}

            {!race && game.state !== "pre" && (
              <span className="sh-hero-score">
                {game.away.score}

                <span>—</span>

                {game.home.score}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="sh-hero-watermark">SPORTS</span>

            <CalendarDays size={140} strokeWidth={0.65} />
          </>
        )}
      </div>
    </section>
  );
}
