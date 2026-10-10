import type { SportsMatchDetail } from "@/lib/sports/espn-types";
import { basketballFive } from "@/lib/sports/field-lineups";
import { useBpT } from "../bp-i18n";
import { BP_SPORTS_NOTE, BP_SPORTS_VALUE } from "./bp-sports-extra-kit";
import { BP_LIVE_SURFACE, BpLiveSeat } from "./bp-sports-live-kit";

const LINE = "absolute block border border-[var(--bp-edge-2)]";

const FIVE = 5;

function starters(detail: SportsMatchDetail, home: boolean): number {
  const roster = home ? detail.homeRoster : detail.awayRoster;
  return roster.filter((player) => player.starter).length;
}

function surname(name: string): string {
  return name.split(" ").at(-1) ?? name;
}

export function bpSportsHasCourt(group: string, detail: SportsMatchDetail | null): boolean {
  if (group !== "basketball" || !detail) return false;
  return starters(detail, true) >= FIVE && starters(detail, false) >= FIVE;
}

export function BpSportsLiveCourt({ detail }: { detail: SportsMatchDetail }) {
  const t = useBpT();
  const home = basketballFive(detail.homeRoster);
  const away = basketballFive(detail.awayRoster);

  return (
    <>
      <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,22px)]">
        <span className={`${BP_SPORTS_VALUE} min-w-0 truncate`}>{detail.home.name}</span>
        <span className={`${BP_SPORTS_VALUE} min-w-0 truncate text-end`}>{detail.away.name}</span>
      </span>
      <span className={`${BP_LIVE_SURFACE} [aspect-ratio:16/9]`}>
        <span className={`${LINE} inset-[3%]`} />
        <span className={`${LINE} left-1/2 top-[3%] bottom-[3%] w-0 border-y-0 border-r-0`} />
        <span
          className={`${LINE} left-1/2 top-1/2 h-[26%] w-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full`}
        />
        <span className={`${LINE} left-[3%] top-1/2 h-[38%] w-[17%] -translate-y-1/2`} />
        <span className={`${LINE} right-[3%] top-1/2 h-[38%] w-[17%] -translate-y-1/2`} />
        <span
          className={`${LINE} left-[3%] top-1/2 h-[68%] w-[34%] -translate-y-1/2 rounded-r-full border-l-0`}
        />
        <span
          className={`${LINE} right-[3%] top-1/2 h-[68%] w-[34%] -translate-y-1/2 rounded-l-full border-r-0`}
        />
        {home.map((seat, index) => (
          <BpLiveSeat
            key={`home:${seat.player?.id ?? seat.slot}:${index}`}
            jersey={seat.player?.jersey || seat.slot}
            name={seat.player ? surname(seat.player.name) : seat.slot}
            left={seat.x}
            top={seat.y}
            home
          />
        ))}
        {away.map((seat, index) => (
          <BpLiveSeat
            key={`away:${seat.player?.id ?? seat.slot}:${index}`}
            jersey={seat.player?.jersey || seat.slot}
            name={seat.player ? surname(seat.player.name) : seat.slot}
            left={100 - seat.x}
            top={seat.y}
            home={false}
          />
        ))}
      </span>
      <span className={`${BP_SPORTS_NOTE} w-full`}>
        {t("Lineup positions, not live player tracking.")}
      </span>
    </>
  );
}
