import type { LeagueDef } from "./espn-types";

export type AustralianDbLeague = LeagueDef & {
  officialWebsite: string;
  coverage: "schedule";
};

/** Verified provider schedules only. AFL already exists in the ESPN catalog. */
export const AUSTRALIAN_DB_LEAGUES: AustralianDbLeague[] = [
  {
    key: "AFLW",
    tag: "AFLW",
    label: "دوري كرة القدم الأسترالية للسيدات",
    labelEn: "AFLW",
    path: "5311",
    group: "aussie",
    logo: "/sports/logos/league-aflw.png",
    officialWebsite: "https://www.afl.com.au/aflw",
    coverage: "schedule",
  },
];

export type AustralianCompetitionGuide = {
  key: string;
  label: string;
  group: "aussie";
  logo: string;
  officialWebsite: string;
  fixturesUrl: string;
  coverage: "directory";
};

const SANFL_LOGO = "/sports/logos/league-sanfl.svg";
const WAFL_LOGO = "/sports/logos/league-wafl.png";

/** Official competition sites without an ESPN/TheSportsDB schedule ID.
 * Keep these out of HUB_LEAGUES: they open the publisher's fixtures, not an empty feed.
 * SANFL and WAFL use their official association marks for both competitions.
 */
export const AUSTRALIAN_COMPETITION_GUIDES: AustralianCompetitionGuide[] = [
  {
    key: "VFL",
    label: "VFL",
    group: "aussie",
    logo: "/sports/logos/league-vfl.svg",
    officialWebsite: "https://www.afl.com.au/vfl",
    fixturesUrl: "https://www.afl.com.au/fixture?Competition=7",
    coverage: "directory",
  },
  {
    key: "VFLW",
    label: "VFLW",
    group: "aussie",
    logo: "/sports/logos/league-vflw.svg",
    officialWebsite: "https://www.afl.com.au/vflw",
    fixturesUrl: "https://www.afl.com.au/fixture?Competition=11",
    coverage: "directory",
  },
  {
    key: "SANFL",
    label: "SANFL",
    group: "aussie",
    logo: SANFL_LOGO,
    officialWebsite: "https://sanfl.com.au/",
    fixturesUrl: "https://sanfl.com.au/league/matches/",
    coverage: "directory",
  },
  {
    key: "SANFLW",
    label: "SANFLW",
    group: "aussie",
    logo: SANFL_LOGO,
    officialWebsite: "https://sanfl.com.au/league/womens/",
    fixturesUrl: "https://sanfl.com.au/league/matches/?league=womens",
    coverage: "directory",
  },
  {
    key: "WAFL",
    label: "WAFL",
    group: "aussie",
    logo: WAFL_LOGO,
    officialWebsite: "https://www.wafl.com.au/",
    fixturesUrl: "https://www.wafl.com.au/fixtures-and-results",
    coverage: "directory",
  },
  {
    key: "WAFLW",
    label: "WAFLW",
    group: "aussie",
    logo: WAFL_LOGO,
    officialWebsite: "https://www.wafl.com.au/",
    // The official fixture page exposes WAFLW through its competition selector.
    fixturesUrl: "https://www.wafl.com.au/fixtures-and-results",
    coverage: "directory",
  },
];
