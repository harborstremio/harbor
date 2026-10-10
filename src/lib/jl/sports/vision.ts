import { useSyncExternalStore } from "react";
import {
  jlAccountContext,
  jlRest,
  jlStorage,
  jlStorageUrl,
  subscribeJlSession,
} from "@/lib/jl/account/client";
import { LEAGUES } from "@/lib/sports/espn";
import type { ArtKind } from "./custom-art";
import {
  createVisionStore,
  espnLeagueFromPath,
  type VisionTeam,
  type VisionTheme,
} from "./vision-branding";

/**
 * The app's JL Vision branding store (vision-branding.ts) and the lookups the Sports Hub uses:
 * a Harbor league plus an ESPN team id in, the linked JL Vision team, palette, logo and art out.
 * Signed out, or for a team that isn't linked, every lookup answers null.
 */

export const vision = createVisionStore({
  context: jlAccountContext,
  rest: jlRest,
  storage: jlStorage,
  storageUrl: jlStorageUrl,
  subscribe: subscribeJlSession,
});

/** ESPN's league segment for a Harbor league key or tag, in any case ("NCAAF" → "college-football"). */
export function espnLeagueOf(league: string): string | null {
  const wanted = league.toLowerCase();
  const def = LEAGUES.find((l) => l.key.toLowerCase() === wanted || l.tag.toLowerCase() === wanted);
  return espnLeagueFromPath(def?.path);
}

/** The JL Vision team for a Harbor league and ESPN team id. */
export function visionTeamFor(
  league: string,
  espnId: string | null | undefined,
): VisionTeam | null {
  const espnLeague = espnLeagueOf(league);
  return espnLeague && espnId ? vision.byProvider("espn", espnLeague, espnId) : null;
}

export type TeamBrand = {
  team: VisionTeam;
  theme: VisionTheme | null;
  logo: string | null;
};

/** A linked team's verified palette and approved logo; null when there is neither. */
export function teamBrand(league: string, espnId: string | null | undefined): TeamBrand | null {
  const team = visionTeamFor(league, espnId);
  if (!team) return null;
  const theme = vision.theme(team.key);
  const logo = vision.logoUrl(team.key);
  return theme || logo ? { team, theme, logo } : null;
}

const TEAM_KEY = /^team:([a-z0-9-]{1,24}):([A-Za-z0-9._-]{1,40})$/;

/** JL Vision artwork for an art key ("team:ncaaf:2483") and slot, for teams only. */
export function visionArt(key: string, kind: ArtKind): string | null {
  const m = TEAM_KEY.exec(key);
  const team = m ? visionTeamFor(m[1], m[2]) : null;
  return team ? vision.artUrl(team.key, kind) : null;
}

/** Re-renders the caller when JL Vision's data loads or refreshes. */
export function useVisionVersion(): number {
  return useSyncExternalStore(vision.subscribe, vision.version, vision.version);
}

/** teamLook's brand input for a side: the verified palette and approved logo, when there are any. */
export function brandLook(
  league: string,
  espnId: string | null | undefined,
): { primary: string; secondary: string; logo: string | null } | null {
  const brand = teamBrand(league, espnId);
  if (!brand) return null;
  return {
    primary: brand.theme?.primary ?? "",
    secondary: brand.theme?.secondary ?? "",
    logo: brand.logo,
  };
}
