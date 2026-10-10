import type { SportsGame } from "./espn-types";

export type WatchProvider = {
  id: string;
  name: string;
  url: string;
  logo: string;
  matches: string[];
};
export const WATCH_PROVIDERS: WatchProvider[] = [
  {
    id: "nwsl",
    name: "NWSL+",
    url: "https://www.nwslsoccer.com/plus",
    logo: "https://images.nwslsoccer.com/image/private/t_q-best/v1773218760/prd/assets/brand/hp-logo-mobile.svg",
    matches: ["nwsl+"],
  },
  {
    id: "dazn",
    name: "DAZN",
    url: "https://www.dazn.com/",
    logo: "https://www.dazn.com/favicon.ico",
    matches: ["dazn"],
  },
  {
    id: "f1tv",
    name: "F1 TV",
    url: "https://f1tv.formula1.com/",
    logo: "https://www.formula1.com/etc/designs/fom-website/favicon-32x32.png",
    matches: ["f1 tv"],
  },
  {
    id: "espn",
    name: "ESPN",
    url: "https://www.espn.com/watch/",
    logo: "https://a.espncdn.com/favicon.ico",
    matches: ["espn", "abc"],
  },
  {
    id: "apple",
    name: "Apple TV",
    url: "https://tv.apple.com/",
    logo: "https://www.apple.com/favicon.ico",
    matches: ["apple tv"],
  },
  {
    id: "prime",
    name: "Prime Video",
    url: "https://www.primevideo.com/",
    logo: "https://www.primevideo.com/favicon.ico",
    matches: ["prime video", "amazon"],
  },
  {
    id: "peacock",
    name: "Peacock",
    url: "https://www.peacocktv.com/sports",
    logo: "https://www.peacocktv.com/favicon.ico",
    matches: ["peacock", "nbc", "usa network"],
  },
  {
    id: "paramount",
    name: "Paramount+",
    url: "https://www.paramountplus.com/sports/",
    logo: "https://www.paramountplus.com/favicon.ico",
    matches: ["paramount", "cbs"],
  },
  {
    id: "nba",
    name: "NBA League Pass",
    url: "https://www.nba.com/watch/league-pass-stream",
    logo: "https://cdn.nba.com/logos/leagues/logo-nba.svg",
    matches: ["nba league pass", "nba tv"],
  },
  {
    id: "wnba",
    name: "WNBA League Pass",
    url: "https://www.wnba.com/leaguepass",
    logo: "https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png",
    matches: ["wnba league pass", "wnba tv"],
  },
  {
    id: "mlb",
    name: "MLB.TV",
    url: "https://www.mlb.com/live-stream-games/subscribe",
    logo: "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    matches: ["mlb.tv", "mlb tv"],
  },
  {
    id: "ufc",
    name: "UFC Fight Pass",
    url: "https://ufcfightpass.com/",
    logo: "https://www.ufc.com/favicon.ico",
    matches: ["ufc fight pass"],
  },
  {
    id: "one",
    name: "ONE Championship",
    url: "https://www.onefc.com/how-to-watch/",
    logo: "https://cdn.onefc.com/wp-content/uploads/2020/01/ONE_logo-1024-w.png",
    matches: ["one championship"],
  },
  {
    id: "sky",
    name: "Sky Sports",
    url: "https://www.skysports.com/watch",
    logo: "https://www.skysports.com/favicon.ico",
    matches: ["sky sports"],
  },
  {
    id: "tnt",
    name: "TNT Sports",
    url: "https://www.tntsports.co.uk/",
    logo: "https://www.tntsports.co.uk/favicon.ico",
    matches: ["tnt sports"],
  },
];

export function watchProviders(game: SportsGame) {
  const names = (game.broadcasts ?? []).map((name) => name.toLowerCase());
  // A channel name is a token, not a substring: WNBA TV is not NBA TV and NBC is not CNBC.
  const listed = WATCH_PROVIDERS.filter((provider) =>
    provider.matches.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
      return names.some((name) => pattern.test(name));
    }),
  );
  const suggested =
    game.league === "F1"
      ? ["f1tv"]
      : game.league === "BOXING"
        ? ["dazn"]
        : game.league === "UFC"
          ? ["paramount", "ufc"]
          : game.league === "ONE"
            ? ["one"]
            : game.league === "NBA"
              ? ["nba"]
              : game.league === "WNBA"
                ? ["wnba"]
                : game.league === "MLB"
                  ? ["mlb"]
                  : game.league === "MLS"
                    ? ["apple"]
                    : game.league === "NWSL"
                      ? ["nwsl"]
                      : [];
  return [
    ...listed,
    ...WATCH_PROVIDERS.filter(
      (provider) => suggested.includes(provider.id) && !listed.includes(provider),
    ),
  ].map((provider) => ({ ...provider, listed: listed.includes(provider) }));
}
