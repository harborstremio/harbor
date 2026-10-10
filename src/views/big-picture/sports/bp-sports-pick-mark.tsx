import { useState } from "react";
import type { LeagueDef } from "@/lib/sports/espn";
import { LEAGUE_LOGO_BACKGROUNDS } from "@/lib/sports/league-branding";
import { LEAGUE_KEY_LOGO_BACKGROUNDS, leagueLogoSource } from "@/lib/sports/league-logo-source";
import { SportIcon } from "@/views/sports/sport-icon";

export const BP_PICK_MARK_SIZE = "clamp(34px, 4vw, 66px)";

export type BpPickMarkProps = {
  logo?: string;
  text?: string;
  sport?: string;
  plate?: boolean;
  size: string;
};

export function BpPickMark({ logo, text, sport, plate, size }: BpPickMarkProps) {
  const [failed, setFailed] = useState(false);
  const image = logo && !failed ? logo : "";
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-xs)]"
      style={{ width: size, height: size, background: plate ? "var(--bp-plate-hi)" : undefined }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-[6%]"
        />
      ) : text ? (
        <span className="text-[calc(clamp(10px,1.4vh,16px)*var(--bp-up,1))] font-bold uppercase text-ink-subtle">
          {text}
        </span>
      ) : (
        <SportIcon name={sport || "trophy"} className="h-[70%] w-[70%] text-ink-subtle" />
      )}
    </span>
  );
}

export function bpPickLeagueMark(league: LeagueDef, size: string) {
  const canvas =
    LEAGUE_LOGO_BACKGROUNDS[leagueLogoSource(league)] ||
    LEAGUE_KEY_LOGO_BACKGROUNDS[league.key || ""];
  return (
    <BpPickMark
      logo={leagueLogoSource(league)}
      text={league.tag || league.key}
      sport={league.group}
      plate={canvas === "light"}
      size={size}
    />
  );
}
