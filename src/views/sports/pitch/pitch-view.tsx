import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import type { MatchPlayer, SportsMatchDetail } from "@/lib/sports/espn";
import {
  buildPitchLayout,
  goalsFromEvents,
  goalsOf,
  orientPoint,
  subStatesFromEvents,
  toCanvasPoint,
  type PitchLayout,
  type PitchOrientation,
  type PitchSide,
  type SubState,
} from "./pitch-formation";
import { PitchPlayer } from "./pitch-player";
import "./pitch.css";

function PitchMarks() {
  return (
    <div className="pitch-field">
      <span className="pitch-half" />
      <span className="pitch-circle" />
      <span className="pitch-spot pitch-spot-c" />
      <span className="pitch-box pitch-box-a" />
      <span className="pitch-box pitch-box-b" />
      <span className="pitch-six pitch-six-a" />
      <span className="pitch-six pitch-six-b" />
      <span className="pitch-goal pitch-goal-a" />
      <span className="pitch-goal pitch-goal-b" />
      <span className="pitch-spot pitch-spot-a" />
      <span className="pitch-spot pitch-spot-b" />
      <span className="pitch-arc pitch-arc-a" />
      <span className="pitch-arc pitch-arc-b" />
      <span className="pitch-corner pitch-corner-tl" />
      <span className="pitch-corner pitch-corner-tr" />
      <span className="pitch-corner pitch-corner-bl" />
      <span className="pitch-corner pitch-corner-br" />
    </div>
  );
}

function TeamHeading({
  name,
  logo,
  formation,
  inferred,
  align,
}: {
  name: string;
  logo: string;
  formation: string;
  inferred: boolean;
  align: "start" | "end";
}) {
  const t = useT();
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === "end" ? "flex-row-reverse" : ""}`}>
      {logo ? (
        <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full bg-canvas/60" />
      )}
      <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
      {formation && (
        <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted ring-1 ring-inset ring-edge-soft">
          {formation}
        </span>
      )}
      {inferred && (
        <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-subtle">
          {t("Estimated")}
        </span>
      )}
    </div>
  );
}

function BenchRow({
  player,
  goals,
  sub,
}: {
  player: MatchPlayer;
  goals: number;
  sub: SubState | null;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated/60">
      <span dir="ltr" className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-subtle">
        {player.jersey || "-"}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{player.name}</span>
      {goals > 0 && (
        <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-ink px-[3px] text-[9px] font-bold tabular-nums text-canvas">
          {goals}
        </span>
      )}
      {player.yellowCards > 0 && <span className="pitch-card h-[12px] w-[8px] bg-yellow-400" />}
      {player.redCards > 0 && <span className="pitch-card h-[12px] w-[8px] bg-danger" />}
      {sub === "in" && <ArrowUp size={11} strokeWidth={3} className="shrink-0 text-success" />}
      {sub === "out" && <ArrowDown size={11} strokeWidth={3} className="shrink-0 text-danger" />}
      <span className="w-8 shrink-0 text-end text-[10px] uppercase tracking-[0.06em] text-ink-subtle">
        {player.position}
      </span>
    </div>
  );
}

function TeamTokens({
  layout,
  side,
  orientation,
  mirror,
  compact,
  offset,
  goals,
  subs,
}: {
  layout: PitchLayout;
  side: PitchSide;
  orientation: PitchOrientation;
  mirror: boolean;
  compact: boolean;
  offset: number;
  goals: Map<string, number>;
  subs: Map<string, SubState>;
}) {
  return (
    <>
      {layout.slots.map((slot, index) => {
        const canvas = toCanvasPoint(slot, side);
        const point = orientPoint(canvas.x, canvas.y, orientation);
        const left = mirror ? 100 - point.left : point.left;
        const top = point.top;
        return (
          <PitchPlayer
            key={slot.player.id || `${side}-${index}`}
            player={slot.player}
            side={side}
            left={left}
            top={top}
            order={offset + index}
            goals={goalsOf(slot.player, goals)}
            sub={subs.get(slot.player.id) ?? null}
            compact={compact}
            flip={top < 40}
            align={left < 16 ? "start" : left > 84 ? "end" : "center"}
          />
        );
      })}
    </>
  );
}

export function PitchView({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  const rtl = isRtl(useUiLanguage());
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const orientation: PitchOrientation = width >= 620 ? "horizontal" : "vertical";
  const compact = orientation === "horizontal" ? width < 720 : width < 420;
  const mirror = rtl && orientation === "horizontal";

  const homeLayout = useMemo(
    () => buildPitchLayout(detail.homeRoster, detail.homeFormation ?? "", "home"),
    [detail.homeRoster, detail.homeFormation],
  );
  const awayLayout = useMemo(
    () => buildPitchLayout(detail.awayRoster, detail.awayFormation ?? "", "away"),
    [detail.awayRoster, detail.awayFormation],
  );

  const homeGoals = useMemo(
    () => goalsFromEvents(detail.events, detail.homeRoster),
    [detail.events, detail.homeRoster],
  );
  const awayGoals = useMemo(
    () => goalsFromEvents(detail.events, detail.awayRoster),
    [detail.events, detail.awayRoster],
  );
  const homeSubs = useMemo(
    () => subStatesFromEvents(detail.events, detail.homeRoster),
    [detail.events, detail.homeRoster],
  );
  const awaySubs = useMemo(
    () => subStatesFromEvents(detail.events, detail.awayRoster),
    [detail.events, detail.awayRoster],
  );

  if (homeLayout.slots.length === 0 && awayLayout.slots.length === 0) return null;

  const benchColumns: Array<[PitchLayout, Map<string, number>, Map<string, SubState>, string]> = [
    [homeLayout, homeGoals, homeSubs, detail.home.name],
    [awayLayout, awayGoals, awaySubs, detail.away.name],
  ];

  return (
    <div ref={hostRef} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TeamHeading
          name={detail.home.name}
          logo={detail.home.logo}
          formation={homeLayout.formation}
          inferred={homeLayout.inferred}
          align="start"
        />
        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Lineups")}
        </span>
        <TeamHeading
          name={detail.away.name}
          logo={detail.away.logo}
          formation={awayLayout.formation}
          inferred={awayLayout.inferred}
          align="end"
        />
      </div>

      <div className="pitch rounded-lg" data-orientation={orientation}>
        <PitchMarks />
        <div className="pitch-players">
          <TeamTokens
            layout={homeLayout}
            side="home"
            orientation={orientation}
            mirror={mirror}
            compact={compact}
            offset={0}
            goals={homeGoals}
            subs={homeSubs}
          />
          <TeamTokens
            layout={awayLayout}
            side="away"
            orientation={orientation}
            mirror={mirror}
            compact={compact}
            offset={homeLayout.slots.length}
            goals={awayGoals}
            subs={awaySubs}
          />
        </div>
      </div>

      <div className={`grid gap-3 ${width >= 560 ? "grid-cols-2" : "grid-cols-1"}`}>
        {benchColumns.map(([layout, goals, subs, name]) =>
          layout.bench.length === 0 ? null : (
            <div key={layout.side} className="flex flex-col gap-1 rounded-lg bg-canvas/50 p-3">
              <span className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
                {name}
              </span>
              {layout.bench.map((player) => (
                <BenchRow
                  key={player.id}
                  player={player}
                  goals={goalsOf(player, goals)}
                  sub={subs.get(player.id) ?? null}
                />
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
