import type { SportsMatchDetail } from "@/lib/sports/espn-types";
import { useBpT } from "../bp-i18n";
import { BP_SPORTS_LABEL, BP_SPORTS_VALUE } from "./bp-sports-extra-kit";
import { BP_LIVE_READOUT, BP_LIVE_SURFACE, BP_LIVE_TAG, BpLiveFigure } from "./bp-sports-live-kit";

const ENDZONE = "absolute inset-y-0 block w-[8%] bg-[var(--bp-panel-2)]";

const TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function spot(yardLine: number): number {
  return 8 + Math.min(100, Math.max(0, yardLine)) * 0.84;
}

export function bpSportsHasField(detail: SportsMatchDetail | null): boolean {
  return Boolean(detail?.football);
}

export function BpSportsLiveField({ detail }: { detail: SportsMatchDetail }) {
  const t = useBpT();
  const situation = detail.football;
  if (!situation) return null;
  const owner = [detail.home, detail.away].find((side) => side.id === situation.possessionTeamId);
  const marker = situation.yardLine === undefined ? -1 : spot(situation.yardLine);

  return (
    <>
      <span className={BP_LIVE_READOUT}>
        <BpLiveFigure value={situation.down} label={t("Current down")} />
        {situation.distance !== undefined && (
          <BpLiveFigure value={situation.distance} label={t("Distance")} />
        )}
        {owner && (
          <span className="flex min-w-0 flex-col gap-[clamp(3px,0.4vh,7px)]">
            <span className="flex items-center gap-[clamp(8px,0.7vw,14px)]">
              {owner.logo && (
                <img
                  src={owner.logo}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-[clamp(30px,3.6vh,50px)] w-[clamp(30px,3.6vh,50px)] shrink-0 object-contain"
                />
              )}
              <span className={`${BP_SPORTS_VALUE} min-w-0 truncate`}>
                {owner.abbr || owner.name}
              </span>
            </span>
            <span className={`${BP_SPORTS_LABEL} truncate`}>{t("Ball possession")}</span>
          </span>
        )}
      </span>
      <span className={`${BP_LIVE_SURFACE} [aspect-ratio:16/4]`}>
        <span className={`${ENDZONE} left-0`} />
        <span className={`${ENDZONE} right-0`} />
        {TICKS.map((tick) => (
          <span
            key={tick}
            style={{ left: `${8 + tick * 8.4}%` }}
            className="absolute inset-y-[14%] block w-px bg-[var(--bp-edge-2)]"
          />
        ))}
        {marker >= 0 && (
          <span
            style={{ left: `${marker}%` }}
            className="absolute inset-y-0 block w-[clamp(3px,0.3vw,5px)] -translate-x-1/2 bg-ink"
          />
        )}
      </span>
      {situation.yardLineText && (
        <span className={`${BP_LIVE_TAG} w-full truncate`}>
          {`${t("Yard line")}: ${situation.yardLineText}`}
        </span>
      )}
      <span className={`${BP_LIVE_TAG} w-full truncate`}>{t("Latest reported play")}</span>
    </>
  );
}
