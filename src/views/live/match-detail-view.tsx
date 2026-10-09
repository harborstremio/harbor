import { ScoreMetric, ScoreBreakdown } from "@/views/sports/score-breakdown";
import { TeamProfileLink, teamIdentity } from "@/views/sports/team-profile-link";
import { lazy, useState, useMemo, useRef } from "react";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { SportsReminderButton } from "@/views/sports/reminder-button";
import { WhereToWatch } from "@/views/sports/where-to-watch";
import { useMatchDetail } from "@/views/sports/use-match-detail";
import { SportsMatchDetailsSkeleton } from "@/views/sports/sports-skeletons";
import { useAthletePortrait } from "@/views/sports/use-athlete-portrait";
import { useAthleteRecord } from "@/views/sports/use-athlete-record";
import { isIndividualCompetition } from "@/lib/sports/competition-metadata";
import { EventLogo, useEventDate } from "@/views/sports/hub-cards";
import { hubLeague } from "@/lib/sports/hub-data";
import { BoxingEventDetails } from "@/views/sports/boxing-event-details";
import { useBoxingEvent } from "@/views/sports/use-boxing-event";
import "@/views/sports/hub.css";
import { MatchPanel } from "@/views/sports/match-panel";
import { PlayerMatchStats } from "@/views/sports/player-match-stats";
import { WatchSources } from "@/views/sports/watch-sources";
import { BaseballDiamond } from "@/views/sports/baseball-diamond";
import { SoccerPreview } from "@/views/sports/soccer-preview";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import { PlayEventIcon } from "@/views/sports/play-event-icon";
import { VenuePreview } from "@/views/sports/venue-preview";
import { FieldPreview } from "@/views/sports/field-preview";
import { EventOdds } from "@/views/sports/event-odds";
import { AthleteProfileLink } from "@/views/sports/athlete-profile";
import { TennisMatchPanel } from "./match-detail-view/tennis-match-panel";
import { MatchDetailsPanel } from "./match-detail-view/match-details-panel";

const HubEventPage = lazy(() => import("@/views/sports/hub-event-page").then((module) => ({ default: module.HubEventPage })));

export function MatchDetailView({
  eventGames,
  ...props
}: {
  game: SportsGame;
  shellBackAvailable?: boolean;
  eventGames?: SportsGame[];
}) {
  return eventGames ? (
    <HubEventPage {...props} games={eventGames} />
  ) : (
    <HeadToHeadMatchDetail {...props} />
  );
}

function HeadToHeadMatchDetail({
  game,
  shellBackAvailable = false,
}: {
  game: SportsGame;
  shellBackAvailable?: boolean;
}) {
  const t = useT();
  const eventDate = useEventDate();
  const { goBack } = useView();
  const officialBoxing = game.source === "official-boxing";
  const boxingGame = useBoxingEvent(game);
  const { detail, loading, failed, retry } = useMatchDetail(game, !officialBoxing);
  const current = detail ?? boxingGame;
  const league = sportsLeagueByTag(game.league) ?? hubLeague(game.league);
  const individual = !officialBoxing && isIndividualCompetition(league?.group ?? "");
  const homePortrait = useAthletePortrait(
    {
      path: league?.path ?? "",
      group: league?.group,
      name: current.home.name,
      id: current.home.athleteSource === "espn" ? (current.home.athleteId ?? "") : "",
      image: current.home.logo,
    },
    individual,
  );
  const awayPortrait = useAthletePortrait(
    {
      path: league?.path ?? "",
      group: league?.group,
      name: current.away.name,
      id: current.away.athleteSource === "espn" ? (current.away.athleteId ?? "") : "",
      image: current.away.logo,
    },
    individual,
  );
  const isCombat = sportsLeagueByTag(game.league)?.group === "combat";
  const isTennis = game.league === "ATP" || game.league === "WTA";
  const isSoccer = sportsLeagueByTag(game.league)?.group === "soccer";
  const showRecords = isCombat || officialBoxing;
  const homeRecord = useAthleteRecord(current?.home.id, showRecords);
  const awayRecord = useAthleteRecord(current?.away.id, showRecords);
  const tabs = isCombat
    ? ["profile", "stats"]
    : isTennis || isSoccer
      ? ["match"]
      : ["summary", "lineups", "stats"];
  const [tab, setTab] = useState(tabs[0]);
  const scrollRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  return (
    <main
      ref={scrollRef}
      className="sh-match-page"
      onScroll={(event) => setShowTop(event.currentTarget.scrollTop > 700)}
    >
      <header className="sh-match-header">
        {!shellBackAvailable && (
          <button className="sh-button" aria-label={t("Back")} onClick={goBack}>
            <ArrowLeft size={18} />
            {t("Back")}
          </button>
        )}
        <span>{league ? getLeagueLabel(league) : game.league}</span>
      </header>
      <section className="sh-detail-scoreboard">
        <div className="sh-detail-competitor">
          <TeamProfileLink team={teamIdentity(current, "home")} className="sh-team-detail-link">
            <EventLogo
              side={{ ...current.home, logo: homePortrait.image || current.home.logo }}
              fallback={current.home.logo || league?.logo}
              sport={league?.group}
              large
            />
            <h1>{current.home.name}</h1>
          </TeamProfileLink>
          {homeRecord && <small className="sh-detail-record">{homeRecord}</small>}
          {(isCombat || isTennis || officialBoxing) && (
            <AthleteProfileLink
              athlete={{ ...current.home, image: homePortrait.image || current.home.logo }}
              league={game.league}
              label={current.home.name}
            />
          )}
        </div>
        <div className="sh-detail-score">
          <span className={current.state === "in" && !failed ? "sh-live" : "sh-eyebrow"}>
            {t(
              failed
                ? current.state === "pre"
                  ? "Saved"
                  : "Saved scores"
                : current.state === "in"
                  ? "Live now"
                  : current.state === "post"
                    ? "Final"
                    : "Upcoming",
            )}
          </span>
          <ScoreMetric sport={league?.group || ""} game={current} />
          <strong>
            {current.state === "pre" ? (
              t("vs")
            ) : ["motorsport", "golf"].includes(league?.group || "") ? (
              t("Results")
            ) : (
              <>
                {current.home.score}
                <em>:</em>
                {current.away.score}
              </>
            )}
          </strong>
          {current.state !== "pre" && <small>{current.detail}</small>}
          <time>{eventDate(current.startMs, false, current.dateOnly)}</time>
        </div>
        <div className="sh-detail-competitor">
          <TeamProfileLink team={teamIdentity(current, "away")} className="sh-team-detail-link">
            <EventLogo
              side={{ ...current.away, logo: awayPortrait.image || current.away.logo }}
              fallback={current.away.logo || league?.logo}
              sport={league?.group}
              large
            />
            <h1>{current.away.name}</h1>
          </TeamProfileLink>
          {awayRecord && <small className="sh-detail-record">{awayRecord}</small>}
          {(isCombat || isTennis || officialBoxing) && (
            <AthleteProfileLink
              athlete={{ ...current.away, image: awayPortrait.image || current.away.logo }}
              league={game.league}
              label={current.away.name}
            />
          )}
        </div>
      </section>
      <ScoreBreakdown game={current} sport={league?.group || ""} />
      <div className="sh-match-event-actions">
        <SportsReminderButton game={current} />
      </div>
      <div className="sh-match-photo-credit">
        {[homePortrait, awayPortrait]
          .flatMap((portrait, index, portraits) => {
            const credit = portrait.attribution;
            return credit &&
              credit.source !== "ESPN" &&
              !portraits
                .slice(0, index)
                .some((prior) => prior.attribution?.sourceUrl === credit.sourceUrl)
              ? [credit]
              : [];
          })
          .map((credit) => (
            <button
              key={credit.sourceUrl}
              className="sh-text-button min-h-9 text-xs text-ink-muted"
              onClick={() => openUrl(credit.sourceUrl)}
            >
              {t("Photos")}: {credit.source}
            </button>
          ))}
      </div>
      <div className="sh-detail-watch">
        <WatchSources
          game={{
            ...current,
            broadcasts: current.broadcasts ?? game.broadcasts,
          }}
        />
      </div>
      <div className="sh-detail-content">
        {(sportsLeagueByTag(game.league)?.group === "football" ||
          sportsLeagueByTag(game.league)?.group === "basketball") && (
          <FieldPreview
            key={`${game.league}:${game.id}`}
            game={current}
            detail={detail}
            basketball={sportsLeagueByTag(game.league)?.group === "basketball"}
            failed={failed}
          />
        )}
        {sportsLeagueByTag(game.league)?.group === "baseball" && (
          <BaseballDiamond
            key={`${game.league}:${game.id}`}
            game={current}
            detail={detail}
            loading={loading}
            failed={failed}
            retry={retry}
          />
        )}
        {isSoccer && (
          <SoccerPreview
            key={`${game.league}:${game.id}`}
            game={current}
            detail={detail}
            loading={loading}
            failed={failed}
          />
        )}
        <VenuePreview
          key={`venue:${game.league}:${game.id}`}
          game={current}
          detail={detail}
          failed={failed}
          sport={sportsLeagueByTag(game.league)?.group ?? ""}
        />
        <WhereToWatch
          game={{ ...current, broadcasts: current.broadcasts ?? game.broadcasts }}
        />
        <EventOdds game={current} />
      </div>
      <div className="sh-detail-content">
        {officialBoxing ? (
          <BoxingEventDetails game={current} />
        ) : <MatchDetailsPanel tabs={tabs} selected={tab} onChange={setTab}>
          {loading ? (
          <SportsMatchDetailsSkeleton />
        ) : !detail ? (
          <div className="sh-empty">
            <h2>{t("Match details are not available yet.")}</h2>
            <p>{t("The schedule is still available. Try refreshing the match details.")}</p>
            <button className="sh-button" onClick={retry}>
              {t("Retry")}
            </button>
          </div>
        ) : (
          <>
            {failed && (
              <div className="sh-feed-note" role="status">
                {t("Showing saved match details.")}
                <button className="sh-text-button" onClick={retry}>
                  {t("Retry")}
                </button>
              </div>
            )}
            {tab === "match" &&
              (isSoccer ? (
                <MatchPanel game={game} detail={detail} hideScoreboard hidePitch />
              ) : (
                <TennisMatchPanel detail={detail} />
              ))}
            {tab === "summary" && <SummaryTab detail={detail} />}
            {tab === "lineups" && <LineupsTab detail={detail} />}
            {tab === "stats" && <StatsTab detail={detail} />}
            {tab === "profile" && <MmaProfileTab detail={detail} />}
          </>
        )}
        </MatchDetailsPanel>}
      </div>
      {showTop && (
        <button
          className="sh-back-top"
          aria-label={t("Back to top")}
          onClick={() => {
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
            scrollRef.current
              ?.querySelector<HTMLButtonElement>("button")
              ?.focus({ preventScroll: true });
          }}
        >
          <ArrowUp size={18} />
          {t("Back to top")}
        </button>
      )}
    </main>
  );
}

function SummaryTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  if (!detail.events || detail.events.length === 0) {
    return (
      <div className="text-center text-sm text-ink-subtle">{t("No events available yet.")}</div>
    );
  }

  const allPlayers = [...detail.homeRoster, ...detail.awayRoster];

  return (
    <div className="flex flex-col gap-4">
      {detail.events.map((e, i) => {
        let playerImage = "";
        let foundPlayer = null;
        if (e.participantName) {
          const pName = e.participantName.toLowerCase();
          foundPlayer = allPlayers.find((p) => {
            const lower = p.name.toLowerCase();
            return (
              lower === pName ||
              lower.includes(pName) ||
              pName.includes(lower.split(" ").pop() || "___")
            );
          });
        }
        if (!foundPlayer && e.text) {
          const textLower = e.text.toLowerCase();
          foundPlayer = allPlayers.find((p) => {
            const lastName = p.name.toLowerCase().split(" ").pop();
            return lastName && lastName.length > 2 && textLower.includes(lastName);
          });
        }
        if (foundPlayer && foundPlayer.image) {
          playerImage = foundPlayer.image;
        }

        return (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-edge-soft/30 bg-elevated/40 p-4"
          >
            <div className="flex w-12 shrink-0 items-center justify-center font-bold text-ink-muted">
              {e.time}
            </div>
            {playerImage ? (
              <img
                src={playerImage}
                className="h-10 w-10 shrink-0 rounded-full bg-canvas object-cover ring-1 ring-edge-soft/50"
                alt=""
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas ring-1 ring-edge-soft/50">
                <PlayEventIcon event={e} />
              </div>
            )}
            <div className="flex flex-1 flex-col justify-center gap-1">
              <span className="text-[14px] font-semibold text-ink">{e.text}</span>
              {e.participantName && (
                <span className="text-[12px] text-ink-subtle">{e.participantName}</span>
              )}
            </div>
            {playerImage && (
              <div className="flex shrink-0 items-center justify-center px-2">
                <PlayEventIcon event={e} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LineupsTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  if (!detail.homeRoster.length && !detail.awayRoster.length) {
    return (
      <div className="text-center text-sm text-ink-subtle">
        {t("Lineups not available yet.")}
      </div>
    );
  }

  const isSoccer = [
    "EPL",
    "UCL",
    "LALIGA",
    "SERIEA",
    "BUNDESLIGA",
    "LIGUE1",
    "MLS",
    "ROSHN",
    "UEL",
    "UECL",
    "WC",
    "AFC",
  ].includes(detail.league);

  return (
    <div className="flex flex-col gap-8">
      {isSoccer && detail.homeRoster.length > 0 && (
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between border-b border-edge-soft/50 pb-2 px-2">
              <div className="flex items-center gap-3">
                {detail.home.logo && (
                  <TeamProfileLink team={teamIdentity(detail, "home")}>
                    <img src={detail.home.logo} className="h-8 w-8 object-contain" alt="" />
                  </TeamProfileLink>
                )}
                <TeamProfileLink team={teamIdentity(detail, "home")}>
                  <span className="font-bold text-lg">{detail.home.name}</span>
                </TeamProfileLink>
              </div>
              {detail.homeFormation && (
                <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-ink-muted ring-1 ring-edge-soft/50">
                  {detail.homeFormation}
                </span>
              )}
            </div>
            <TeamPitch
              roster={detail.homeRoster}
              formation={detail.homeFormation || ""}
              teamAbbr={detail.home.abbr || t("HOME")}
              isHome={true}
            />
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between border-b border-edge-soft/50 pb-2 px-2">
              <div className="flex items-center gap-3">
                {detail.away.logo && (
                  <TeamProfileLink team={teamIdentity(detail, "away")}>
                    <img src={detail.away.logo} className="h-8 w-8 object-contain" alt="" />
                  </TeamProfileLink>
                )}
                <TeamProfileLink team={teamIdentity(detail, "away")}>
                  <span className="font-bold text-lg">{detail.away.name}</span>
                </TeamProfileLink>
              </div>
              {detail.awayFormation && (
                <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-ink-muted ring-1 ring-edge-soft/50">
                  {detail.awayFormation}
                </span>
              )}
            </div>
            <TeamPitch
              roster={detail.awayRoster}
              formation={detail.awayFormation || ""}
              teamAbbr={detail.away.abbr || t("AWAY")}
              isHome={false}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-elevated/30 p-4 ring-1 ring-edge-soft/50">
          <div className="text-sm font-bold uppercase tracking-wider text-ink-muted border-b border-edge-soft/50 pb-2">
            <TeamProfileLink team={teamIdentity(detail, "home")}>
              {detail.home.name}
            </TeamProfileLink>{" "}
            - {t("Full Roster")}
          </div>
          <div className="flex flex-col gap-2">
            {detail.homeRoster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="flex w-6 items-center justify-center text-xs font-bold text-ink-subtle">
                  {p.jersey || "-"}
                </span>
                <span
                  className={`flex-1 ${p.starter ? "font-bold text-ink" : "font-medium text-ink-muted"}`}
                >
                  <AthleteProfileLink athlete={p} league={detail.league} label={p.name} />
                </span>
                <span className="w-8 text-end text-[11px] font-semibold uppercase text-brand/80">
                  {p.position}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-elevated/30 p-4 ring-1 ring-edge-soft/50">
          <div className="text-sm font-bold uppercase tracking-wider text-ink-muted border-b border-edge-soft/50 pb-2">
            <TeamProfileLink team={teamIdentity(detail, "away")}>
              {detail.away.name}
            </TeamProfileLink>{" "}
            - {t("Full Roster")}
          </div>
          <div className="flex flex-col gap-2">
            {detail.awayRoster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="flex w-6 items-center justify-center text-xs font-bold text-ink-subtle">
                  {p.jersey || "-"}
                </span>
                <span
                  className={`flex-1 ${p.starter ? "font-bold text-ink" : "font-medium text-ink-muted"}`}
                >
                  <AthleteProfileLink athlete={p} league={detail.league} label={p.name} />
                </span>
                <span className="w-8 text-end text-[11px] font-semibold uppercase text-brand/80">
                  {p.position}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PitchPlayerNode({ player, isHome }: { player: any; isHome: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-[12px] font-bold shadow-md ring-2 ring-canvas/80 md:h-10 md:w-10 md:text-[14px]">
        {player.image ? (
          <img src={player.image} className="h-full w-full rounded-full object-cover" alt="" />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center rounded-full ${isHome ? "bg-brand text-brand-foreground" : "bg-white text-black"}`}
          >
            {player.jersey || "-"}
          </div>
        )}
      </div>
      <span className="max-w-[60px] truncate text-center text-[10px] font-semibold text-white drop-shadow-md md:max-w-[80px] md:text-[11px] bg-black/40 px-1.5 py-0.5 rounded">
        {player.name.split(" ").pop()}
      </span>
    </div>
  );
}

function TeamPitch({
  roster,
  formation,
  teamAbbr,
  isHome,
}: {
  roster: any[];
  formation: string;
  teamAbbr: string;
  isHome: boolean;
}) {
  const starters = roster.filter((p) => p.starter).slice(0, 11);
  const keeper =
    starters.find((p) => p.position && p.position.toUpperCase().includes("G")) || starters[0];
  const field = starters.filter((p) => p.id !== keeper?.id);

  const pitchRows = useMemo(() => {
    if (!formation) {
      const defs = field.filter((p) => p.position && p.position.toUpperCase().includes("D"));
      const mids = field.filter((p) => p.position && p.position.toUpperCase().includes("M"));
      const fwds = field.filter(
        (p) =>
          p.position &&
          (p.position.toUpperCase().includes("F") ||
            p.position.toUpperCase().includes("A") ||
            p.position.toUpperCase().includes("S")),
      );

      const unknowns = field.filter(
        (p) => !defs.includes(p) && !mids.includes(p) && !fwds.includes(p),
      );
      const finalMids = [...mids, ...unknowns];

      return [[keeper], defs, finalMids, fwds].filter((row) => row.length > 0);
    }

    const counts = formation
      .split("-")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (counts.length === 0) return [[keeper], field];

    const rows: any[][] = [];
    let offset = 0;
    for (const c of counts) {
      rows.push(field.slice(offset, offset + c));
      offset += c;
    }

    return [...rows.reverse(), [keeper]];
  }, [formation, field, keeper]);

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-edge-soft/50 bg-[#2b4c30] p-4 shadow-xl aspect-[3/4]">
      <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 top-4 h-24 w-48 -translate-x-1/2 rounded-b-xl border-2 border-t-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-4 h-32 w-64 -translate-x-1/2 rounded-t-xl border-2 border-b-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-4 h-12 w-24 -translate-x-1/2 rounded-t-lg border-2 border-b-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-[calc(1rem+32px)] h-2 w-2 -translate-x-1/2 rounded-full bg-white/40"></div>

      <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[10px] font-bold uppercase text-white/80">
        {teamAbbr}
      </div>

      <div className="relative z-10 flex w-full flex-1 flex-col justify-between py-4">
        {pitchRows.map((row: any[], i: number) => (
          <div key={i} className="flex w-full justify-around px-2">
            {row.map((p: any) => (
              <PitchPlayerNode key={p.id} player={p} isHome={isHome} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type ProfileStatLabel = "Height" | "Weight" | "Age" | "Reach" | "Stance";

const RECORD_VALUE = /^\s*\d+\s*-\s*\d+(?:\s*-\s*\d+)?\s*$/;

function statMeasure(value: string): number | null {
  const feet = value.match(/(\d+)\s*'\s*(\d+(?:\.\d+)?)?/);
  if (feet) return Number(feet[1]) * 12 + Number(feet[2] ?? 0);
  const plain = value.match(/-?\d+(?:\.\d+)?/);
  return plain ? Number(plain[0]) : null;
}

function StatRow({
  label,
  hVal,
  aVal,
}: {
  label: ProfileStatLabel;
  hVal: string;
  aVal: string;
}) {
  const t = useT();
  const ranked = label !== "Stance";
  const hNum = ranked ? statMeasure(hVal || "") : null;
  const aNum = ranked ? statMeasure(aVal || "") : null;
  const hLeads = hNum !== null && aNum !== null && hNum > aNum;
  const aLeads = hNum !== null && aNum !== null && aNum > hNum;

  return (
    <div className="flex items-center justify-between py-2 text-sm font-medium">
      <div
        className={`w-12 text-center tabular-nums sm:w-16 ${hLeads ? "font-bold text-ink" : "text-ink-subtle"}`}
      >
        {hVal || "-"}
      </div>
      <div className="flex-1 px-2 text-center text-xs tracking-wider text-ink-subtle uppercase">
        {t(label)}
      </div>
      <div
        className={`w-12 text-center tabular-nums sm:w-16 ${aLeads ? "font-bold text-ink" : "text-ink-subtle"}`}
      >
        {aVal || "-"}
      </div>
    </div>
  );
}

function MmaProfileTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  const hP = detail.homeProfile;
  const aP = detail.awayProfile;

  if (!hP || !aP) {
    return (
      <div className="text-center text-sm text-ink-subtle">
        {t("Profile details not available.")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end bg-elevated/20 rounded-2xl p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink/5" />

        <div className="flex-1 flex flex-col items-center z-10">
          <div className="h-64 sm:h-80 relative w-full flex justify-center">
            {hP.fullImage && (
              <img
                src={hP.fullImage}
                className="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]"
                alt={detail.home.name}
              />
            )}
          </div>
          <div className="font-bold text-lg mt-2">{detail.home.name}</div>
        </div>

        <div className="shrink-0 flex items-center justify-center font-black text-ink-muted px-4 z-10 opacity-30 text-2xl">
          {t("VS")}
        </div>

        <div className="flex-1 flex flex-col items-center z-10">
          <div className="h-64 sm:h-80 relative w-full flex justify-center">
            {aP.fullImage && (
              <img
                src={aP.fullImage}
                className="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]"
                alt={detail.away.name}
              />
            )}
          </div>
          <div className="font-bold text-lg mt-2">{detail.away.name}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-elevated/20 p-4 ring-1 ring-edge-soft/50 shadow-sm">
        <StatRow label="Height" hVal={hP.height} aVal={aP.height} />
        <StatRow label="Weight" hVal={hP.weight} aVal={aP.weight} />
        <StatRow label="Age" hVal={hP.age} aVal={aP.age} />
        <StatRow label="Reach" hVal={hP.reach} aVal={aP.reach} />
        <StatRow label="Stance" hVal={hP.stance} aVal={aP.stance} />
      </div>
    </div>
  );
}

function StatsTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();

  const StatsTabRow = ({
    label,
    hVal,
    aVal,
  }: {
    label: string;
    hVal?: string;
    aVal?: string;
  }) => {
    if (!hVal && !aVal) return null;

    const ranked = !RECORD_VALUE.test(hVal || "") && !RECORD_VALUE.test(aVal || "");
    const hNum = ranked ? statMeasure(hVal || "") : null;
    const aNum = ranked ? statMeasure(aVal || "") : null;

    const hIsGreater = hNum !== null && aNum !== null && hNum > aNum;
    const aIsGreater = hNum !== null && aNum !== null && aNum > hNum;

    return (
      <div className="flex items-center justify-between border-b border-edge-soft/50 py-3 text-sm last:border-0">
        <span className={`w-12 font-bold ${hIsGreater ? "text-green-500" : "text-ink"}`}>
          {hVal || "0"}
        </span>
        <span className="text-ink-subtle">
          {label === "Overall Record" ? t("Overall Record") : label}
        </span>
        <span
          className={`w-12 text-end font-bold ${aIsGreater ? "text-green-500" : "text-ink"}`}
        >
          {aVal || "0"}
        </span>
      </div>
    );
  };

  if (
    (!detail.allStats || detail.allStats.length === 0) &&
    !detail.playerStats?.length &&
    !detail.partnerships?.length
  ) {
    return (
      <div className="text-center text-sm text-ink-subtle">
        {t("Statistics not available yet.")}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!!detail.allStats.length && (
        <div className="flex flex-col gap-1 rounded-2xl bg-elevated/20 p-4 ring-1 ring-edge-soft/50 shadow-sm">
          {detail.allStats.map((stat, i) => (
            <StatsTabRow
              key={i}
              label={stat.label}
              hVal={stat.homeValue}
              aVal={stat.awayValue}
            />
          ))}
        </div>
      )}
      <PlayerMatchStats detail={detail} />
    </div>
  );
}
