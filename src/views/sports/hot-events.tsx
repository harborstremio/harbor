import { useEventVenuePhoto } from "./use-event-venue-photo";
import { SportsSelect } from "./sports-select";
import { SportsHeroScenery } from "./sports-hero-scenery";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, CalendarDays, ChevronDown, LoaderCircle } from "lucide-react";
import { Play } from "@/components/icons/play-filled";

import { useT, useUiLanguage } from "@/lib/i18n";

import { useInViewport, usePageVisible } from "@/lib/visibility";

import { getGroupLabel, getLeagueLabel, type SportsGame } from "@/lib/sports/espn";

import { involvesTeam, type FavouriteTeam } from "@/lib/sports/favourites";

import {
  HOT_EVENT_LEAGUES,
  hotEventCalendarParts,
  hotEvents,
  type HotEvent,
} from "@/lib/sports/hot-events";

import { dayStamp, HUB_GROUPS, HUB_LEAGUES, hubLeague } from "@/lib/sports/hub-data";

import { gameKey, mergeSlices } from "@/lib/sports/hub-cache";

import { useSportsHub } from "./use-hub";

import { useSportsArtwork } from "./use-artwork";

import { EventLogo, useEventDate } from "./hub-cards";

import { LeagueLogo } from "./league-logo";

import { SportsReminderButton } from "./reminder-button";

import { SportIcon } from "./sport-icon";

import { SportsVideoPreview } from "./sports-video-preview";

import "./hot-events.css";

import { TeamProfileLink, teamIdentity } from "./team-profile-link";

import "./team-links.css";

function HotArtwork({
  game,

  lead = false,
}: {
  game: SportsGame;

  lead?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  const visible = useInViewport(root, lead);

  const venuePhoto = useEventVenuePhoto(game, visible);
  const art = useSportsArtwork(visible && !venuePhoto ? game : undefined);

  const league = hubLeague(game.league);

  const [failed, setFailed] = useState<string[]>([]);

  const [loaded, setLoaded] = useState("");

  const image = [venuePhoto?.photo, game.artwork, game.poster].find(
    (url): url is string => !!url && !failed.includes(url),
  );

  const venueTeam =
    image === venuePhoto?.photo &&
    !!image &&
    ["football", "baseball", "basketball", "hockey"].includes(league?.group || "");
  const fight = ["combat", "boxing"].includes(league?.group || "");

  const solo = ["motorsport", "golf", "esports"].includes(league?.group || "");

  return (
    <div
      ref={root}

      className={`hot-art ${fight ? "is-fight" : ""} ${venueTeam ? "is-venue-team" : ""}`}
    >
      <SportsHeroScenery league={game?.league} sport={league?.group} priority={lead} />
      <span className="hot-art-lettering">{game.league}</span>
      {image && (
        <>
          <img
            className="hot-art-photo"

            src={image}

            alt=""

            loading={lead ? "eager" : "lazy"}

            decoding="async"

            draggable={false}

            data-ready={loaded === image}

            onLoad={() => setLoaded(image)}

            onError={() => setFailed((prior) => [...prior, image])}
          />

          {loaded !== image && <LoaderCircle className="hot-art-spinner" size={24} />}
        </>
      )}
      {(!image || venueTeam) && (
        <div className="hot-art-logos">
          {solo ? (
            <EventLogo
              side={{ ...game.home, logo: league?.logo || game.home.logo }}

              large

              sport={league?.group}
            />
          ) : (
            <>
              <TeamProfileLink team={teamIdentity(game, "away")} className="hot-art-team-link">
                <EventLogo
                  side={{ ...game.away, logo: art.away || game.away.logo }}

                  large

                  fallback={league?.logo}

                  sport={league?.group}
                />
              </TeamProfileLink>

              <span className="hot-art-versus">/</span>

              <TeamProfileLink team={teamIdentity(game, "home")} className="hot-art-team-link">
                <EventLogo
                  side={{ ...game.home, logo: art.home || game.home.logo }}

                  large

                  fallback={league?.logo}

                  sport={league?.group}
                />
              </TeamProfileLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function hotEventTitle(game: SportsGame) {
  return game.context?.name || `${game.away.name} · ${game.home.name}`;
}

function HotTeamTitle({ game }: { game: SportsGame }) {
  return (
    game.context?.name || (
      <>
        <TeamProfileLink team={teamIdentity(game, "away")}>{game.away.name}</TeamProfileLink> ·{" "}
        <TeamProfileLink team={teamIdentity(game, "home")}>{game.home.name}</TeamProfileLink>
      </>
    )
  );
}

function HotPoster({
  item,

  lead = false,

  onOpen,
}: {
  item: HotEvent;

  lead?: boolean;

  onOpen: (game: SportsGame) => void;
}) {
  const t = useT();

  const date = useEventDate();

  const game = item.game;

  const league = hubLeague(game.league);

  return (
    <article className={`hot-poster ${lead ? "is-lead" : ""}`}>
      <div className="hot-poster-open" data-sports-preview-trigger>
        <div className="hot-poster-link">
          <button
            className="sh-event-open"
            onClick={() => onOpen(game)}
            aria-label={`${t("Explore event")} · ${hotEventTitle(game)}`}
          />

          <HotArtwork key={gameKey(game)} game={game} lead={lead} />

          {game.state === "in" && <span className="hot-reason is-live">{t("Live now")}</span>}

          <span className="hot-poster-copy">
            <span className="hot-league">
              {league && <LeagueLogo league={league} size={23} />}{" "}
              {league ? getLeagueLabel(league) : game.league}
            </span>

            {lead ? (
              <h2>
                <HotTeamTitle game={game} />
              </h2>
            ) : (
              <h3>
                <HotTeamTitle game={game} />
              </h3>
            )}

            <span className="hot-when">
              {game.state === "in"
                ? `${game.away.score} : ${game.home.score} · ${game.detail}`
                : date(game.startMs, false, game.dateOnly)}

              {game.savedAt !== undefined && ` · ${t("Saved schedule")}`}
            </span>

            {lead && game.context?.venue && <span className="hot-venue">{game.context.venue}</span>}

            <span className="hot-open-label">
              {t("Explore event")}

              <Play size={17} />
            </span>
          </span>
        </div>

        <SportsVideoPreview
          query={{
            names: [game.away.name, game.home.name],

            participants: [game.away, game.home].map(({ name, abbr }) => ({
              name,

              abbr,
            })),

            league: game.league,

            eventTitle: game.context?.name,

            eventStartMs: game.startMs,
          }}

          title={hotEventTitle(game)}
        />
      </div>

      <div className="hot-poster-footer">
        <SportsReminderButton game={game} />
      </div>
    </article>
  );
}

function WeekLogos({ game }: { game: SportsGame }) {
  const league = hubLeague(game.league);

  const event = ["combat", "boxing", "motorsport", "esports", "golf"].includes(league?.group || "");

  return (
    <span className={`hot-week-logos ${event ? "is-event" : ""}`}>
      {event && league ? (
        <LeagueLogo league={league} size={44} />
      ) : (
        <>
          <TeamProfileLink team={teamIdentity(game, "away")} className="hot-week-team-link">
            <EventLogo
              side={game.away}

              fallback={league?.logo}

              sport={league?.group}
            />
          </TeamProfileLink>

          <TeamProfileLink team={teamIdentity(game, "home")} className="hot-week-team-link">
            <EventLogo
              side={game.home}

              fallback={league?.logo}

              sport={league?.group}
            />
          </TeamProfileLink>
        </>
      )}
    </span>
  );
}

export function HotEventsContent({
  games,

  loading,

  stale,

  now,

  favourites,

  onOpen,

  onExplore,
}: {
  games: SportsGame[];

  loading: boolean;

  stale: boolean;

  now: number;

  favourites: FavouriteTeam[];

  onOpen: (game: SportsGame) => void;

  onExplore: () => void;
}) {
  const t = useT();

  const locale = useUiLanguage();

  const [windowFilter, setWindowFilter] = useState("all");

  const [sport, setSport] = useState("all");

  const ranked = useMemo(
    () => hotEvents(games, now, (game) => favourites.some((team) => involvesTeam(game, team))),

    [games, now, favourites],
  );

  const items = ranked.filter(
    (item) =>
      (sport === "all" || item.group === sport) &&
      (windowFilter === "live"
        ? item.game.state === "in"
        : windowFilter === "week"
          ? item.game.startMs < now + 7 * 86400000
          : true),
  );

  const [lead, ...rest] = items;

  const week = items

    .filter((item) => item.game.startMs < now + 7 * 86400000)

    .sort((a, b) => a.game.startMs - b.game.startMs);

  return (
    <section className="hot-events" aria-label={t("Hot Events")}>
      <div className="hot-heading">
        <div>
          <h2>{t("Hot events")}</h2>
        </div>

        <span className="hot-edition">
          <CalendarDays size={16} />

          {new Date(now).toLocaleDateString(locale, {
            month: "long",

            day: "numeric",
          })}
        </span>
      </div>

      <div className="hot-filters">
        <div role="group" aria-label={t("Event window")}>
          {[
            ["all", "All highlights"],

            ["week", "Next 7 days"],

            ["live", "Live now"],
          ].map(([key, label]) => (
            <button
              key={key}

              aria-pressed={windowFilter === key}

              onClick={() => setWindowFilter(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>

        <SportsSelect
          ariaLabel={t("Filter by sport")}
          value={sport}
          onChange={setSport}
          options={[
            { value: "all", label: t("All sports"), left: <SportIcon name="trophy" size={20} /> },
            ...HUB_GROUPS.filter((group) => ranked.some((item) => item.group === group.key)).map(
              (group) => ({
                value: group.key,
                label: getGroupLabel(group),
                left: <SportIcon name={group.key} size={20} />,
              }),
            ),
          ]}
        />
      </div>

      {loading && !ranked.length ? (
        <div
          className="hot-skeleton"

          role="status"

          aria-label={t("Loading highlights…")}
        >
          <div />

          <div />

          <div />
        </div>
      ) : lead ? (
        <>
          <div className="hot-feature">
            <HotPoster
              key={gameKey(lead.game)}

              item={lead}

              lead

              onOpen={onOpen}
            />

            <aside className="hot-week harbor-scroll">
              <div>
                <h3>{t("This week")}</h3>
              </div>

              {week.map((item) => {
                const calendar = hotEventCalendarParts(item.game, locale);

                return (
                  <article className="hot-week-item" key={gameKey(item.game)}>
                    <button
                      className="sh-event-open"
                      onClick={() => onOpen(item.game)}
                      aria-label={`${t("Explore event")} · ${hotEventTitle(item.game)}`}
                    />

                    <time dateTime={calendar.dateTime}>
                      <b>{calendar.day}</b>

                      <small>{calendar.month}</small>
                    </time>

                    <WeekLogos game={item.game} />

                    <span className="hot-week-copy">
                      <small>
                        {hubLeague(item.game.league)
                          ? getLeagueLabel(hubLeague(item.game.league)!)
                          : item.game.league}
                      </small>

                      <strong>
                        <HotTeamTitle game={item.game} />
                      </strong>
                    </span>

                    <ArrowRight size={16} />
                  </article>
                );
              })}

              {!week.length && <p>{t("No highlights scheduled this week.")}</p>}
            </aside>
          </div>

          {!!rest.length && (
            <>
              <div className="hot-section-title">
                <h3>{t("More events")}</h3>

                <span>{t("{n} events", { n: rest.length })}</span>
              </div>

              <div className="hot-grid">
                {rest.map((item) => (
                  <HotPoster
                    key={gameKey(item.game)}

                    item={item}

                    onOpen={onOpen}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="hot-empty">
          <h3>
            {t(
              windowFilter === "live"
                ? "No live highlights right now."
                : "No events match these filters.",
            )}
          </h3>

          <p>{t("Try all highlights, or explore the full sports schedule.")}</p>

          <button
            className="sh-button"

            onClick={() => {
              setWindowFilter("all");

              setSport("all");
            }}
          >
            {t("All highlights")}
          </button>

          <button className="sh-text-button" onClick={onExplore}>
            {t("Explore sports")}

            <ArrowRight size={16} />
          </button>
        </div>
      )}

      <details className="hot-selection">
        <summary>
          {t("How these events are picked")}

          <ChevronDown size={15} />
        </summary>

        <p>
          {t(
            "Selected from available schedules using championship stages, headline fight cards, major leagues, race weekends and your followed teams. These are editorial highlights, not measured audience rankings.",
          )}
        </p>

        {stale && (
          <p>{t("Some events use saved schedules. Check event details for the latest status.")}</p>
        )}
      </details>
    </section>
  );
}

export function HotEvents({
  seed,

  active,

  refresh,

  favourites,

  onOpen,

  onExplore,
}: {
  seed: SportsGame[];

  active: boolean;

  refresh: number;

  favourites: FavouriteTeam[];

  onOpen: (game: SportsGame) => void;

  onExplore: () => void;
}) {
  const pageVisible = usePageVisible();

  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active || !pageVisible) return;

    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), 60000);

    return () => clearInterval(timer);
  }, [active, pageVisible]);

  const leagues = useMemo(
    () =>
      [
        ...new Set([
          ...HOT_EVENT_LEAGUES,

          ...favourites.map((team) => team.leagueKey),
        ]),
      ]

        .filter((key) => HUB_LEAGUES.some((league) => league.key === key))

        .slice(0, 24),

    [favourites],
  );

  const feed = useSportsHub(
    leagues,

    dayStamp(new Date(now)),

    active,

    refresh,

    "upcoming",
  );

  const games = useMemo(
    () =>
      mergeSlices([
        { at: 1, games: seed },

        { at: 2, games: feed.games },
      ]),

    [seed, feed.games],
  );

  return (
    <HotEventsContent
      games={games}

      loading={feed.pending > 0}

      stale={feed.stale || feed.failed > 0}

      now={now}

      favourites={favourites}

      onOpen={onOpen}

      onExplore={onExplore}
    />
  );
}
