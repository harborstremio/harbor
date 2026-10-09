export type SportsBroadcast = {
  id: string;
  title: string;
  competition: string;
  channel: string;
  art?: string;
  source: string;
  league?: string;
};

// Organizer-published channels, not claims that a match is currently live.
export const SPORTS_BROADCASTS: SportsBroadcast[] = [
  {
    id: "rlcs",
    title: "Rocket League",
    competition: "RLCS",
    league: "RLCS",
    channel: "RocketLeague",
    art: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/252950/0a3a0440e101436b154c06040722f27950d67e22/header_alt_assets_16.jpg",
    source:
      "https://www.epicgames.com/help/en-US/rocket-league-c5719357623323/trending-c0/what-are-the-official-sites-and-social-media-accounts-for-rocket-league-a5720120766107",
  },
  {
    id: "valorant",
    title: "VALORANT",
    competition: "Champions Tour",
    channel: "valorant",
    source: "https://valorantesports.com/en-GB/news/watch-and-earn-masters-toronto",
  },
  {
    id: "lec",
    title: "League of Legends",
    competition: "LEC",
    league: "LEC",
    channel: "lec",
    source:
      "https://lolesports.com/en-US/news/2023-lec-season-finals-more-broadcast-partners-and-more-co-streams",
  },
  {
    id: "dota",
    title: "Dota 2",
    competition: "The International",
    channel: "dota2ti",
    art: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
    source: "https://blog.twitch.tv/en/2013/08/06/watch-the-international-on-twitch-ab87fe2f9363/",
  },
];

// Not a playback path. Twitch answers `frame-ancestors https://<parent>` and Harbor's packaged
// origin is `http://tauri.localhost`, so this URL only loads in an iframe on the dev server.
// Playback goes through esportsPlayback, which opens a Twitch channel top-level.
export function twitchEmbedUrl(channel: string, hostname: string): string | null {
  if (
    !/^[a-zA-Z0-9_]{1,25}$/.test(channel) ||
    !hostname ||
    !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(hostname)
  )
    return null;
  const params = new URLSearchParams({
    channel,
    parent: hostname,
    autoplay: "false",
    muted: "false",
  });
  return `https://player.twitch.tv/?${params}`;
}
