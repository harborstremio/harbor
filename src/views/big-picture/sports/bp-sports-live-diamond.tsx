import type { MatchPlayer, SportsMatchDetail } from "@/lib/sports/espn-types";
import { useBpT } from "../bp-i18n";
import { BP_SPORTS_LABEL, BP_SPORTS_VALUE } from "./bp-sports-extra-kit";
import { BP_LIVE_READOUT, BP_LIVE_TAG, BpLiveFigure, BpLivePips } from "./bp-sports-live-kit";

const BASE =
  "absolute block h-[clamp(19px,2.3vh,33px)] w-[clamp(19px,2.3vh,33px)] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px]";

const OPEN_BASE = "bg-[var(--bp-panel)] ring-1 ring-[var(--bp-edge-2)]";

const CORNERS: Array<{ key: string; left: number; top: number }> = [
  { key: "first", left: 88, top: 50 },
  { key: "second", left: 50, top: 12 },
  { key: "third", left: 12, top: 50 },
];

function held(detail: SportsMatchDetail): Array<string | undefined> {
  const situation = detail.baseball;
  return [situation?.onFirstId, situation?.onSecondId, situation?.onThirdId];
}

function nameOf(roster: MatchPlayer[], id: string | undefined): string {
  if (!id) return "";
  return roster.find((player) => player.id === id)?.name ?? "";
}

export function bpSportsHasDiamond(detail: SportsMatchDetail | null): boolean {
  const situation = detail?.baseball;
  if (!detail || !situation || detail.state !== "in") return false;
  return (
    situation.balls !== undefined ||
    situation.strikes !== undefined ||
    situation.outs !== undefined ||
    situation.batterId !== undefined ||
    held(detail).some(Boolean)
  );
}

export function BpSportsLiveDiamond({ detail }: { detail: SportsMatchDetail }) {
  const t = useBpT();
  const situation = detail.baseball;
  const roster = [...detail.homeRoster, ...detail.awayRoster];
  const runners = held(detail);
  const batter = nameOf(roster, situation?.batterId);
  const pitcher = nameOf(roster, situation?.pitcherId);
  const labels = [t("First base"), t("Second base"), t("Third base")];

  return (
    <>
      <span className="flex w-full flex-wrap items-center gap-x-[clamp(20px,2.2vw,50px)] gap-y-[clamp(14px,1.6vh,26px)]">
        <span className="relative block w-[clamp(150px,15vw,280px)] shrink-0 [aspect-ratio:1/1]">
          <span className="absolute left-1/2 top-1/2 block h-[54%] w-[54%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)]" />
          <span className="absolute left-1/2 top-1/2 block h-[clamp(9px,1.1vh,15px)] w-[clamp(9px,1.1vh,15px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bp-edge-2)]" />
          {CORNERS.map((corner, index) => (
            <span
              key={corner.key}
              title={labels[index]}
              style={{ left: `${corner.left}%`, top: `${corner.top}%` }}
              className={`${BASE} ${runners[index] ? "bg-ink" : OPEN_BASE}`}
            />
          ))}
          <span style={{ left: "50%", top: "88%" }} className={`${BASE} bg-[var(--bp-edge-2)]`} />
        </span>
        <span className={BP_LIVE_READOUT}>
          {situation?.balls !== undefined && (
            <BpLiveFigure value={situation.balls} label={t("Balls")} />
          )}
          {situation?.strikes !== undefined && (
            <BpLiveFigure value={situation.strikes} label={t("Strikes")} />
          )}
          {situation?.outs !== undefined && (
            <BpLivePips filled={situation.outs} total={3} label={t("Outs")} />
          )}
        </span>
      </span>
      {(batter || pitcher) && (
        <span className="flex w-full flex-wrap gap-x-[clamp(22px,2.4vw,56px)] gap-y-[clamp(6px,0.8vh,12px)]">
          {batter && (
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className={BP_SPORTS_LABEL}>{t("At bat")}</span>
              <span className={`${BP_SPORTS_VALUE} truncate`}>{batter}</span>
            </span>
          )}
          {pitcher && (
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className={BP_SPORTS_LABEL}>{t("Pitching")}</span>
              <span className={`${BP_SPORTS_VALUE} truncate`}>{pitcher}</span>
            </span>
          )}
        </span>
      )}
      {runners.some(Boolean) && (
        <span className={`${BP_LIVE_TAG} w-full truncate`}>
          {runners
            .map((id, index) =>
              id ? `${labels[index]}: ${nameOf(roster, id) || t("On base")}` : "",
            )
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </>
  );
}
