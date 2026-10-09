import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { SFX } from "@/lib/sfx";
import type {
  MatchPlayer,
  MatchTeamStatRow,
  SportsGame,
  SportsMatchDetail,
} from "@/lib/sports/espn-types";
import { hubLeague } from "@/lib/sports/hub-data";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { watchProviders } from "@/lib/sports/watch-providers";
import { openUrl } from "@/lib/window";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_LABEL as LABEL,
  BP_SPORTS_MICRO as MICRO,
  BP_SPORTS_NAME as NAME,
  BP_SPORTS_NOTE as NOTE,
  BP_SPORTS_PAIRS as PAIRS,
  BP_SPORTS_POS as POS,
  BP_SPORTS_ROWCOL as ROWCOL,
  BP_SPORTS_TIP as TIP,
  BP_SPORTS_VALUE as VALUE,
  BpSportsPanelCell,
  BpSportsPanelRow,
  useBpSportsFixture,
} from "./bp-sports-extra-kit";
import { useBpSportsOddsRow } from "./bp-sports-extra-odds";
import { bpSportsPlayerStatCells } from "./bp-sports-extra-players";
import { BpSportsPitchCell, bpSportsHasPitch } from "./bp-sports-extra-pitch";
import { BpSportsVenueCell, useBpSportsVenue } from "./bp-sports-extra-venue";
import { BpSportsLivePlaysCell, bpSportsHasPlays } from "./bp-sports-live-plays";
import { BpSportsLiveSituationCell, bpSportsSituationKind } from "./bp-sports-live-situation";

export { BpSportsFactsRow, BpSportsStandingsRow } from "./bp-sports-extra-tables";

const WHERE =
  "flex min-h-[44px] w-[clamp(250px,22vw,420px)] shrink-0 items-center gap-[clamp(11px,0.9vw,18px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(13px,1.1vw,22px)] py-[clamp(11px,1.2vh,19px)] text-start";

const SIDE_W = "clamp(320px,30vw,600px)";

const PAIRED = 8;

const COL = "clamp(340px,34vw,700px)";

const COL_GAP = "clamp(22px,2.4vw,56px)";

const PAD = "clamp(18px,1.7vw,34px)";

type StatLine = MatchTeamStatRow & { bar: boolean };

function statsWidth(cols: number): string {
  return `calc(${cols} * ${COL} + ${cols - 1} * ${COL_GAP} + 2 * ${PAD} + 2px)`;
}

function statLines(detail: SportsMatchDetail | null, t: ReturnType<typeof useBpT>): StatLine[] {
  if (!detail) return [];
  const lines: StatLine[] = detail.allStats.map((stat) => ({ ...stat, bar: true }));
  const home = detail.homeProfile;
  const away = detail.awayProfile;
  if (!home || !away) return lines;
  const tape: Array<[string, string, string]> = [
    [t("Height"), home.height, away.height],
    [t("Weight"), home.weight, away.weight],
    [t("Age"), home.age, away.age],
    [t("Reach"), home.reach, away.reach],
    [t("Stance"), home.stance, away.stance],
  ];
  for (const [label, homeValue, awayValue] of tape) {
    if (homeValue !== "-" || awayValue !== "-")
      lines.push({ label, homeValue, awayValue, bar: false });
  }
  return lines;
}

const UFC_GUIDE = "https://www.ufc.com/watch";

const F1_GUIDE =
  "https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ";

function numberOf(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function BpTeamStatsCell({ lines, caption }: { lines: StatLine[]; caption: string }) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const more = lines.length > PAIRED;
  const shown = expanded ? lines : lines.slice(0, PAIRED);
  const cols = shown.length <= 6 ? 1 : shown.length <= 12 ? 2 : 3;

  return (
    <BpSportsPanelCell
      restoreKey="sports-stats"
      width={statsWidth(cols)}
      grow={`calc(${cols} * clamp(460px,48vw,960px))`}
      shrink={statsWidth(1)}
      expanded={more ? expanded : undefined}
      onPress={more ? () => setExpanded(!expanded) : undefined}
      foot={more ? (expanded ? t("Show less") : t("Show all {n}", { n: lines.length })) : ""}
    >
      {caption !== "" && <span className={`${TIP} truncate`}>{caption}</span>}
      <span className={PAIRS}>
        {shown.map((stat) => {
          const away = numberOf(stat.awayValue);
          const total = away + numberOf(stat.homeValue);
          const share = total > 0 ? Math.round((away / total) * 100) : 50;
          return (
            <span key={stat.label} className="flex w-full flex-col gap-[5px]">
              <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,20px)]">
                <span className={`${VALUE} tabular-nums`}>{stat.awayValue || "0"}</span>
                <span className={`${LABEL} min-w-0 truncate`}>{stat.label}</span>
                <span className={`${VALUE} tabular-nums`}>{stat.homeValue || "0"}</span>
              </span>
              {stat.bar && (
                <span className="flex h-[clamp(5px,0.7vh,10px)] w-full overflow-hidden rounded-full bg-[var(--bp-void)]/60">
                  <span className="h-full bg-[var(--bp-on)]" style={{ width: `${share}%` }} />
                  <span className="h-full flex-1 bg-[var(--bp-edge-2)]" />
                </span>
              )}
            </span>
          );
        })}
      </span>
    </BpSportsPanelCell>
  );
}

type StatsRow = { game?: SportsGame; detail: SportsMatchDetail | null };

export function BpSportsStatsRow({ game, detail }: StatsRow) {
  const t = useBpT();
  const fixture = useBpSportsFixture(game ?? detail);
  const odds = useBpSportsOddsRow(fixture);
  const lines = statLines(detail, t);
  const stats = lines.length > 0;
  const kind = bpSportsSituationKind(fixture, detail);
  const plays = bpSportsHasPlays(detail);
  const live = kind !== "" || plays;
  if (!stats && odds.count === 0 && !live) return null;
  const surface =
    kind === "diamond"
      ? t("On the diamond")
      : kind === "field"
        ? t("On the field")
        : t("On the court");
  const playsLabel = t("Play by play");
  const statsLabel = t("Key statistics");
  const oddsLabel = t("Market odds");
  const title =
    live && fixture?.state === "in"
      ? t("Live now")
      : stats && odds.count > 0
        ? t("Odds and statistics")
        : stats
          ? statsLabel
          : odds.count > 0
            ? oddsLabel
            : plays
              ? playsLabel
              : surface;
  const quiet = (label: string) => (label === title ? "" : label);

  return (
    <BpSportsPanelRow
      rowKey="sports-stats"
      reserve={live ? "680px" : "420px"}
      title={title}
      foot={
        odds.note ? (
          <p className={`${NOTE} max-w-[min(76vw,1280px)] px-[var(--bp-gutter)]`}>{odds.note}</p>
        ) : undefined
      }
    >
      {kind !== "" && detail ? (
        <BpSportsLiveSituationCell kind={kind} detail={detail} caption={quiet(surface)} />
      ) : null}
      {plays && detail ? (
        <BpSportsLivePlaysCell detail={detail} caption={quiet(playsLabel)} />
      ) : null}
      {odds.cells(quiet(oddsLabel))}
      {stats ? <BpTeamStatsCell lines={lines} caption={quiet(statsLabel)} /> : null}
    </BpSportsPanelRow>
  );
}

type LineupCell = {
  name: string;
  formation: string;
  roster: MatchPlayer[];
  restoreKey: string;
};

function BpLineupCell({ name, formation, roster, restoreKey }: LineupCell) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const ordered = [...roster].sort((a, b) => Number(b.starter) - Number(a.starter));
  const starters = ordered.filter((p) => p.starter).length || Math.min(11, ordered.length);
  const shown = expanded ? ordered : ordered.slice(0, starters);
  const rest = ordered.length - shown.length;

  return (
    <BpSportsPanelCell
      restoreKey={restoreKey}
      width={SIDE_W}
      expanded={expanded}
      onPress={() => setExpanded(!expanded)}
      foot={rest > 0 ? t("Show all {n}", { n: ordered.length }) : expanded ? t("Show less") : ""}
    >
      <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,20px)]">
        <span className={`${VALUE} min-w-0 truncate`}>{name}</span>
        {formation && <span className={LABEL}>{formation}</span>}
      </span>
      {shown.map((player) => (
        <span
          key={player.id || player.name}
          className="flex w-full items-baseline gap-[clamp(10px,1vw,20px)]"
        >
          <span className={`${MICRO} ${ROWCOL}`}>{player.jersey}</span>
          <span className={`${NAME} font-semibold min-w-0 flex-1 truncate`}>{player.name}</span>
          <span className={`${POS} shrink-0`}>{player.position}</span>
        </span>
      ))}
    </BpSportsPanelCell>
  );
}

type LineupsRow = { game: SportsGame; detail: SportsMatchDetail | null; group?: string };

export function BpSportsLineupsRow({ game, detail, group }: LineupsRow) {
  const t = useBpT();
  const homeRoster = detail?.homeRoster ?? [];
  const awayRoster = detail?.awayRoster ?? [];
  const players = bpSportsPlayerStatCells(detail);
  const kind =
    group ?? sportsLeagueByTag(game.league)?.group ?? hubLeague(game.league)?.group ?? "";
  const pitch = bpSportsHasPitch(kind, detail);
  const rosters = homeRoster.length > 0 || awayRoster.length > 0;
  if (!rosters && players.length === 0) return null;
  const title =
    rosters && players.length > 0
      ? t("Lineups and player statistics")
      : rosters
        ? t("Lineups")
        : t("Player statistics");

  return (
    <BpSportsPanelRow rowKey="sports-lineups" reserve="900px" title={title}>
      {pitch && detail ? <BpSportsPitchCell game={game} detail={detail} /> : null}
      {awayRoster.length > 0 && (
        <BpLineupCell
          restoreKey="sports-lineup-away"
          name={game.away.name}
          formation={detail?.awayFormation ?? ""}
          roster={awayRoster}
        />
      )}
      {homeRoster.length > 0 && (
        <BpLineupCell
          restoreKey="sports-lineup-home"
          name={game.home.name}
          formation={detail?.homeFormation ?? ""}
          roster={homeRoster}
        />
      )}
      {players}
    </BpSportsPanelRow>
  );
}

export function BpSportsWhereRow({ game }: { game: SportsGame }) {
  const t = useBpT();
  const venue = useBpSportsVenue(game);
  const marks = watchProviders(game).map((provider) => ({
    id: provider.id,
    name: provider.name,
    note: provider.listed ? t("Listed broadcaster") : t("Check event availability"),
    logo: provider.logo,
    url: provider.url,
  }));
  const taken = new Set(marks.map((mark) => mark.id));
  if (game.league === "UFC" && !taken.has("ufc")) {
    marks.push({
      id: "ufc",
      name: t("Official UFC watch guide"),
      note: "",
      logo: "",
      url: UFC_GUIDE,
    });
  }
  if (game.league === "F1" && !taken.has("f1")) {
    marks.push({
      id: "f1",
      name: t("Find your country's F1 broadcaster"),
      note: "",
      logo: "",
      url: F1_GUIDE,
    });
  }
  if (marks.length === 0 && !venue) return null;

  return (
    <BpSportsPanelRow
      rowKey="sports-where"
      reserve="520px"
      title={venue ? t("Venue and where to watch") : t("Where to watch")}
      foot={
        marks.length > 0 ? (
          <p className={`${NOTE} max-w-[min(76vw,1280px)] px-[var(--bp-gutter)]`}>
            {t(
              "Subscriptions, pay-per-view and regional availability are set by each provider. Check that the event is included before purchasing.",
            )}{" "}
            {t(
              "Use only sources you are authorized to access. Harbor does not bypass subscriptions or access restrictions.",
            )}
          </p>
        ) : undefined
      }
    >
      {venue ? <BpSportsVenueCell view={venue} /> : null}
      {marks.map((mark) => (
        <button
          key={mark.id}
          type="button"
          data-bp-focusable
          data-bp-tile
          data-bp-restore-key={`sports-where-${mark.id}`}
          onClick={() => {
            SFX.open();
            openUrl(mark.url);
          }}
          className={WHERE}
        >
          {mark.logo && (
            <img
              src={mark.logo}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-[clamp(32px,3.8vh,54px)] w-[clamp(32px,3.8vh,54px)] shrink-0 rounded-[8px] object-contain"
            />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className={`${NAME} font-semibold truncate`}>{mark.name}</span>
            {mark.note && <span className={`${NOTE} truncate`}>{mark.note}</span>}
          </span>
          <ExternalLink className="h-[clamp(16px,1.9vh,24px)] w-[clamp(16px,1.9vh,24px)] shrink-0 text-ink-subtle" />
        </button>
      ))}
    </BpSportsPanelRow>
  );
}
