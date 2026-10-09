import { TeamProfileLink, teamIdentity } from "./team-profile-link";
import { SportsFixturesSkeleton, SportsScheduleSkeleton } from "./sports-skeletons";
import "./team-links.css";
import { LeagueGuideLauncher } from "./league-guide-launcher";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInViewport } from "@/lib/visibility";
import { ChevronDown, ChevronRight, Search, Radio } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { getLeagueLabel, getGroupLabel, type SportsGame } from "@/lib/sports/espn";
import { gameKey } from "@/lib/sports/hub-cache";
import { hubLeague, HUB_GROUPS } from "@/lib/sports/hub-data";
import { EventLogo } from "./hub-cards";
import { SportIcon } from "./sport-icon";
import { scheduleEvents } from "@/lib/sports/fight-card";
import { LeagueLogo } from "./league-logo";
import { FightCard } from "./fight-card";
import { PillRail } from "./pill-rail";
import { EsportsImage } from "./esports-image";
import { fetchEsportsTeamLogos } from "@/lib/sports/esports-profiles";

function searchableNames(game: SportsGame): string {
  const sides = [game.home, game.away, ...(game.field ?? [])];
  const people = sides.flatMap((side) => [
    side.name,
    ...(side.members ?? []).map((member) => member.name),
  ]);
  return [...people, game.context?.name || "", hubLeague(game.league)?.labelEn || ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function HubSchedule({
  games,
  onOpen,
  stale,
  loading,
  failed,
  title,
  liveOnly = false,
}: {
  games: SportsGame[];
  onOpen: (game: SportsGame) => void;
  stale: boolean;
  loading: boolean;
  failed: boolean;
  title: string;
  liveOnly?: boolean;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [sport, setSport] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [dotaLogos, setDotaLogos] = useState<Map<string, string>>(() => new Map());
  const needsDotaLogos =
    (sport === "all" || sport === "esports") &&
    (leagueFilter === "all" || leagueFilter === "DOTA2") &&
    !collapsed.includes("DOTA2") &&
    games.some((game) => game.league === "DOTA2" && (!game.home.logo || !game.away.logo));
  useEffect(() => {
    if (!needsDotaLogos) return;
    const controller = new AbortController();
    // One shared, cached directory request for the board, never one request per row.
    void fetchEsportsTeamLogos(controller.signal)
      .then((logos) => {
        if (!controller.signal.aborted) setDotaLogos(logos);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [needsDotaLogos]);
  if (!games.length && loading) return <SportsScheduleSkeleton />;
  const sports = HUB_GROUPS.filter((group) =>
    games.some((game) => hubLeague(game.league)?.group === group.key),
  );
  const activeSport = sports.some((group) => group.key === sport) ? sport : "all";
  const sportGames = games.filter(
    (game) => activeSport === "all" || hubLeague(game.league)?.group === activeSport,
  );
  const leagues = [...new Set(sportGames.map((game) => game.league))];
  const activeLeague = leagues.includes(leagueFilter) ? leagueFilter : "all";
  const scoped = sportGames.filter(
    (game) => activeLeague === "all" || game.league === activeLeague,
  );
  const filtered = scoped.filter(
    (game) =>
      (liveOnly
        ? game.state === "in" && game.savedAt === undefined
        : filter === "all" || game.state === filter) &&
      searchableNames(game).includes(search.toLowerCase()),
  );
  const tags = [...new Set(filtered.map((game) => game.league))].sort(
    (a, b) =>
      Number(filtered.some((g) => g.league === b && g.state === "in")) -
      Number(filtered.some((g) => g.league === a && g.state === "in")),
  );
  return (
    <section className="sh-match-center">
      <div className="sh-section-head">
        <div>
          <span className="sh-eyebrow">{t("MATCH CENTER")}</span>
          <h2>{title}</h2>
        </div>
        <span className="sh-match-total">
          {t("{n} matches", { n: scheduleEvents(games).length })}
        </span>
      </div>
      <PillRail className="sh-match-sport-pills" label={t("Filter by sport")}>
        <button
          aria-pressed={activeSport === "all"}
          onClick={() => {
            setSport("all");
            setLeagueFilter("all");
          }}
        >
          <SportIcon name="trophy" size={19} />
          {t("All sports")}
          <small>{scheduleEvents(games).length}</small>
        </button>
        {sports.map((group) => (
          <button
            key={group.key}
            aria-pressed={activeSport === group.key}
            onClick={() => {
              setSport(group.key);
              setLeagueFilter("all");
            }}
          >
            <SportIcon name={group.key} size={19} />
            {getGroupLabel(group)}
            <small>
              {
                scheduleEvents(games.filter((game) => hubLeague(game.league)?.group === group.key))
                  .length
              }
            </small>
          </button>
        ))}
      </PillRail>
      {leagues.length > 1 && (
        <PillRail className="sh-match-league-pills" label={t("League")}>
          <button aria-pressed={activeLeague === "all"} onClick={() => setLeagueFilter("all")}>
            {t("All leagues")}
          </button>
          {leagues.map((tag) => {
            const league = hubLeague(tag);
            return (
              <button
                key={tag}
                aria-pressed={activeLeague === tag}
                onClick={() => setLeagueFilter(tag)}
              >
                {league && <LeagueLogo league={league} size={22} />}
                {league ? getLeagueLabel(league) : tag}
              </button>
            );
          })}
        </PillRail>
      )}
      <div className="sh-board-toolbar">
        <div className="sh-board-filters">
          {(liveOnly
            ? [["in", "Live"]]
            : [
                ["all", "All matches"],
                [
                  "in",
                  scoped.some((game) => game.state === "in" && game.savedAt === undefined)
                    ? "Live"
                    : stale
                      ? "Saved scores"
                      : "Live",
                ],
                ["pre", "Upcoming"],
                ["post", "Final"],
              ]
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={liveOnly || filter === key}
              onClick={() => setFilter(key)}
            >
              {key === "in" && <Radio size={14} />} {t(label)}{" "}
              <span>
                {key === "all"
                  ? scheduleEvents(scoped).length
                  : scheduleEvents(scoped.filter((game) => game.state === key)).length}
              </span>
            </button>
          ))}
        </div>
        <label className="sh-board-search">
          <Search size={16} />
          <input
            aria-label={t("Find a match")}
            placeholder={t("Find a match")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {tags.map((tag) => {
        const league = hubLeague(tag);
        const matches = filtered.filter((g) => g.league === tag);
        const closed = collapsed.includes(tag);
        const live = matches.filter((g) => g.state === "in" && g.savedAt === undefined).length;
        return (
          <ScheduleLeague
            key={tag}
            count={scheduleEvents(matches).length}
            closed={closed}
            heading={
              <div className="sh-league-heading-row">
                <button
                  className="sh-league-heading"
                  aria-expanded={!closed}
                  onClick={() =>
                    setCollapsed((list) =>
                      closed ? list.filter((key) => key !== tag) : [...list, tag],
                    )
                  }
                >
                  <LeagueLogo league={league ?? { logo: "", group: "trophy" }} size={24} />
                  <strong>{league ? getLeagueLabel(league) : tag}</strong>
                  {live > 0 && <span className="sh-live">{t("{n} LIVE", { n: live })}</span>}
                  <span>{scheduleEvents(matches).length}</span>
                  <ChevronDown size={16} className={closed ? "" : "is-open"} />
                </button>
                {league && <LeagueGuideLauncher league={league} />}
              </div>
            }
          >
            {() =>
              scheduleEvents(matches).map((bouts) => {
                const game = bouts[0];
                if (league?.group === "combat" && game.id.includes("|"))
                  return (
                    <FightCard key={game.context?.id || game.id} games={bouts} onOpen={onOpen} />
                  );
                const stale = game.savedAt !== undefined;
                const event =
                  ["combat", "boxing", "motorsport", "golf", "esports"].includes(
                    league?.group || "",
                  ) ||
                  (game.source === "thesportsdb-hub" && !game.away.name);
                const time =
                  game.dateOnly !== undefined
                    ? t("Time TBA")
                    : game.startMs
                      ? new Date(game.startMs).toLocaleTimeString(locale, {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : t("TBD");
                return (
                  <div
                    className={`sh-fixture ${game.state === "in" && !stale ? "is-live" : ""} ${event ? "is-event" : ""}`}
                    key={gameKey(game)}
                  >
                    <button
                      className="sh-event-open"
                      onClick={() => onOpen(game)}
                      aria-label={`${t("Match center")} · ${game.context?.name || `${game.away.name} · ${game.home.name}`}${league?.group === "esports" ? ` · ${game.home.name} · ${game.away.name}` : ""}`}
                    />
                    <span className="sh-fixture-time">
                      {game.state === "in" && !stale ? (
                        <>
                          <i />
                          {game.detail || t("Live")}
                        </>
                      ) : game.state === "post" ? (
                        game.detail || t("Final")
                      ) : (
                        time
                      )}
                      <small>
                        {stale ? t("Saved") : game.state === "pre" ? t("Scheduled") : ""}
                      </small>
                    </span>
                    {event ? (
                      <span
                        className={`sh-fixture-event ${league?.group === "esports" ? "sh-fixture-esports" : ""}`}
                      >
                        {league?.group === "esports" && (
                          <span className="sh-fixture-esports-logos">
                            {[game.home, game.away].filter((side) => side.name).map((side, index) => (
                              <span key={index} title={side.name}>
                                <EsportsImage
                                  src={side.logo || undefined}
                                  fallback={game.league === "DOTA2" ? dotaLogos.get(side.id) : undefined}
                                  name={side.name}
                                />
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="sh-fixture-event-copy">
                          <strong>{game.context?.name || game.home.name}</strong>
                          <small>{game.context?.venue || game.detail}</small>
                        </span>
                      </span>
                    ) : (
                      <span className="sh-fixture-match">
                        <span>
                          <TeamProfileLink
                            team={teamIdentity(game, "away")}
                            className="sh-fixture-team-link"
                          >
                            <strong>{game.away.name}</strong>
                            <EventLogo side={game.away} />
                          </TeamProfileLink>
                        </span>
                        <b>
                          {game.state === "pre" ? (
                            <span className="sh-fixture-vs">{t("vs")}</span>
                          ) : (
                            <>
                              <span>{game.away.score}</span>
                              <em>:</em>
                              <span>{game.home.score}</span>
                            </>
                          )}
                        </b>
                        <span>
                          <TeamProfileLink
                            team={teamIdentity(game, "home")}
                            className="sh-fixture-team-link"
                          >
                            <EventLogo side={game.home} />
                            <strong>{game.home.name}</strong>
                          </TeamProfileLink>
                        </span>
                      </span>
                    )}
                    <span className="sh-fixture-open">
                      <span>{t("Match center")}</span>
                      <ChevronRight size={16} />
                    </span>
                  </div>
                );
              })
            }
          </ScheduleLeague>
        );
      })}
      {!filtered.length && loading && <SportsFixturesSkeleton />}
      {!filtered.length && !loading && (
        <div className="sh-empty" role="status">
          <h2>
            {t(
              loading
                ? "Loading this day's fixtures…"
                : failed
                  ? "Some schedules are unavailable"
                  : liveOnly
                    ? "No live matches right now"
                    : "No matches found",
            )}
          </h2>
          <p>
            {t(
              liveOnly
                ? "Try another sport or league. Live scores refresh automatically."
                : "Choose another date, league or match filter.",
            )}
          </p>
          {!liveOnly && filter !== "all" && (
            <button
              className="sh-button"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              {t("Show all matches")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Keep league headings keyboard-accessible while off-screen fixtures release their DOM and images. */
function ScheduleLeague({
  heading,
  children,
  count,
  closed,
}: {
  heading: ReactNode;
  children: () => ReactNode;
  count: number;
  closed: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const visible = useInViewport(root, false);
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(count * 80);
  const mounted = !closed && (visible || focused);
  useEffect(() => {
    setHeight(count * 80);
  }, [count]);
  useEffect(() => {
    if (!mounted || !body.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next > 0) setHeight(next);
    });
    observer.observe(body.current);
    return () => observer.disconnect();
  }, [mounted]);
  return (
    <section
      ref={root}
      className="sh-league-board"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {heading}
      {!closed &&
        (mounted ? (
          <div ref={body}>{children()}</div>
        ) : (
          <div aria-hidden="true" style={{ height }} />
        ))}
    </section>
  );
}
