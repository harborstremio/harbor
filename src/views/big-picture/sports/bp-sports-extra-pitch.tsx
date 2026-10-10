import { useMemo, useState } from "react";
import type { MatchPlayer, SportsGame, SportsMatchDetail } from "@/lib/sports/espn-types";
import {
  buildPitchLayout,
  goalsFromEvents,
  goalsOf,
  orientPoint,
  subStatesFromEvents,
  toCanvasPoint,
  type PitchSide,
} from "@/views/sports/pitch/pitch-formation";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_MICRO,
  BP_SPORTS_NOTE,
  BP_SPORTS_POS,
  BP_SPORTS_TIP,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
} from "./bp-sports-extra-kit";

const WIDE = "min(72vw,1100px)";

const GRASS =
  "absolute inset-0 [background:repeating-linear-gradient(90deg,var(--bp-panel-2)_0_7.5%,var(--bp-panel)_7.5%_15%)]";

const LINE = "absolute border border-[var(--bp-edge-2)]";

const DOT =
  "flex items-center justify-center rounded-full text-[calc(clamp(10px,1.3vh,15px)*var(--bp-up,1))] font-bold tabular-nums";

type Marked = { player: MatchPlayer; left: number; top: number; goals: number; out: boolean };

function markers(
  roster: MatchPlayer[],
  formation: string,
  side: PitchSide,
  detail: SportsMatchDetail,
): { spots: Marked[]; bench: MatchPlayer[]; formation: string } {
  const layout = buildPitchLayout(roster, formation, side);
  const goals = goalsFromEvents(detail.events, roster);
  const subs = subStatesFromEvents(detail.events, roster);
  return {
    formation: layout.formation,
    bench: layout.bench,
    spots: layout.slots.map((slot) => {
      const point = toCanvasPoint(slot, side);
      const placed = orientPoint(point.x, point.y, "horizontal");
      return {
        player: slot.player,
        left: placed.left,
        top: placed.top,
        goals: goalsOf(slot.player, goals),
        out: subs.get(slot.player.id) === "out",
      };
    }),
  };
}

function BpPitchDot({ spot, home }: { spot: Marked; home: boolean }) {
  const face = home
    ? "bg-[var(--bp-on)] text-ink"
    : "bg-[var(--bp-void)]/85 text-ink ring-1 ring-[var(--bp-edge-2)]";
  return (
    <span
      className="absolute flex w-[clamp(58px,6vw,104px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${spot.left}%`, top: `${spot.top}%`, opacity: spot.out ? 0.45 : 1 }}
    >
      <span className="relative">
        <span className={`${DOT} h-[clamp(26px,3.2vh,46px)] w-[clamp(26px,3.2vh,46px)] ${face}`}>
          {spot.player.jersey || spot.player.position || "-"}
        </span>
        {spot.goals > 0 ? (
          <span
            className={`${DOT} absolute -right-[18%] -top-[18%] h-[clamp(15px,1.8vh,25px)] w-[clamp(15px,1.8vh,25px)] bg-[var(--bp-void)] text-ink ring-1 ring-[var(--bp-on)]`}
          >
            {spot.goals}
          </span>
        ) : null}
      </span>
      <span
        className={`${BP_SPORTS_POS} w-full truncate text-center text-ink [text-shadow:0_1px_4px_var(--bp-void)]`}
      >
        {spot.player.name.split(" ").at(-1)}
      </span>
    </span>
  );
}

export function BpSportsPitchCell({
  game,
  detail,
}: {
  game: SportsGame;
  detail: SportsMatchDetail;
}) {
  const t = useBpT();
  const [expanded, setExpanded] = useState(false);
  const home = useMemo(
    () => markers(detail.homeRoster, detail.homeFormation ?? "", "home", detail),
    [detail],
  );
  const away = useMemo(
    () => markers(detail.awayRoster, detail.awayFormation ?? "", "away", detail),
    [detail],
  );
  const bench = [...home.bench, ...away.bench];

  return (
    <BpSportsPanelCell
      restoreKey="sports-pitch"
      width={WIDE}
      expanded={expanded}
      onPress={() => setExpanded(!expanded)}
      foot={bench.length > 0 ? (expanded ? t("Hide bench") : t("Show bench")) : ""}
    >
      <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,22px)]">
        <span className={`${BP_SPORTS_VALUE} min-w-0 truncate`}>{game.home.name}</span>
        <span className={BP_SPORTS_TIP}>{t("On the pitch")}</span>
        <span className={`${BP_SPORTS_VALUE} min-w-0 truncate text-end`}>{game.away.name}</span>
      </span>
      <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,22px)]">
        <span className={BP_SPORTS_MICRO}>{home.formation}</span>
        <span className={BP_SPORTS_MICRO}>{away.formation}</span>
      </span>
      <span className="relative block w-full overflow-hidden rounded-[var(--bp-r-sm)] [aspect-ratio:16/10]">
        <span className={GRASS} />
        <span className={`${LINE} inset-[2.5%]`} />
        <span className={`${LINE} left-1/2 top-[2.5%] bottom-[2.5%] w-0 border-y-0 border-r-0`} />
        <span
          className={`${LINE} left-1/2 top-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full`}
        />
        <span className={`${LINE} left-[2.5%] top-1/2 h-[46%] w-[13%] -translate-y-1/2`} />
        <span className={`${LINE} right-[2.5%] top-1/2 h-[46%] w-[13%] -translate-y-1/2`} />
        <span className={`${LINE} left-[2.5%] top-1/2 h-[22%] w-[5%] -translate-y-1/2`} />
        <span className={`${LINE} right-[2.5%] top-1/2 h-[22%] w-[5%] -translate-y-1/2`} />
        {home.spots.map((spot) => (
          <BpPitchDot key={`home:${spot.player.id || spot.player.name}`} spot={spot} home />
        ))}
        {away.spots.map((spot) => (
          <BpPitchDot key={`away:${spot.player.id || spot.player.name}`} spot={spot} home={false} />
        ))}
      </span>
      <span className={BP_SPORTS_NOTE}>
        {t("Positions are illustrative from the published lineup, not live tracking.")}
      </span>
      {expanded && bench.length > 0 ? (
        <span className={`${BP_SPORTS_NOTE} w-full`}>
          {`${t("Bench")}: ${bench.map((player) => player.name).join(", ")}`}
        </span>
      ) : null}
    </BpSportsPanelCell>
  );
}

export function bpSportsHasPitch(group: string, detail: SportsMatchDetail | null): boolean {
  if (group !== "soccer" || !detail) return false;
  return (
    detail.homeRoster.some((player) => player.starter) ||
    detail.awayRoster.some((player) => player.starter)
  );
}
