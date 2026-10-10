import type { EsportsStream } from "./esports-streams";

export type EsportsGameId =
  | "cs2"
  | "dota2"
  | "lol"
  | "valorant"
  | "rocketleague"
  | "r6"
  | "overwatch"
  | "cod"
  | "apex"
  | "pubg"
  | "fortnite"
  | "starcraft2";

export type EsportsGameDef = {
  id: EsportsGameId;
  name: string;
  shortName: string;
  genre: string;
  logo: string;
  art: string;
  accent: string;
  officialUrl: string;
  broadcasts: EsportsStream[];
};

const steam = (app: number, file: string) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${app}/${file}`;
const twitch = (title: string, channel: string): EsportsStream => ({
  title,
  url: `https://www.twitch.tv/${channel}`,
  platform: "twitch",
});
const youtube = (title: string, channel: string): EsportsStream => ({
  title,
  url: `https://www.youtube.com/${channel}`,
  platform: "youtube",
});

// Publisher/organizer discovery links and their public brand assets. A channel in
// this directory is not evidence that an event or broadcast is currently live.
// Sources: each officialUrl; Riot's 2026 MSI/VCT watch guides; Ubisoft's Rainbow6
// broadcast redirect; Blizzard's ESL Pro Tour announcement. Verified Sep 2026.
export const ESPORTS_GAMES: EsportsGameDef[] = [
  {
    id: "cs2",
    name: "Counter-Strike 2",
    shortName: "CS2",
    genre: "Tactical shooter",
    logo: steam(730, "logo.png"),
    art: steam(730, "library_hero.jpg"),
    accent: "#e5ae4b",
    officialUrl: "https://pro.eslgaming.com/tour/cs/",
    broadcasts: [twitch("ESL Counter-Strike", "eslcs"), twitch("BLAST Premier", "blastpremier")],
  },
  {
    id: "dota2",
    name: "Dota 2",
    shortName: "Dota 2",
    genre: "MOBA",
    logo: steam(570, "logo.png"),
    art: steam(570, "library_hero.jpg"),
    accent: "#cb5a46",
    officialUrl: "https://www.dota2.com/esports/",
    broadcasts: [twitch("The International", "dota2ti"), youtube("Dota 2", "user/dota2")],
  },
  {
    id: "lol",
    name: "League of Legends",
    shortName: "LoL",
    genre: "MOBA",
    logo: "https://lolesports.com/_next/static/media/lol-logo.3l3euas8usg8p.png",
    art: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg",
    accent: "#c8aa6e",
    officialUrl: "https://lolesports.com/en-US/",
    broadcasts: [
      twitch("Riot Games", "riotgames"),
      youtube("LoL Esports", "channel/UCSF_aFGIIIoWY30GVV19TKA"),
    ],
  },
  {
    id: "valorant",
    name: "VALORANT",
    shortName: "VALORANT",
    genre: "Tactical shooter",
    logo: "https://valorantesports.com/_next/static/media/val-logo-text.2i8n5o6ir4egf.svg",
    art: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/7b60e8bb6c1828831931dad87633604c2264fa26-3440x1020.jpg?auto=format&fit=max&w=1440",
    accent: "#ff4655",
    officialUrl: "https://valorantesports.com/en-US/",
    broadcasts: [
      twitch("VALORANT Champions Tour", "valorant"),
      youtube("VALORANT Esports", "@ValorantEsports"),
    ],
  },
  {
    id: "rocketleague",
    name: "Rocket League",
    shortName: "Rocket League",
    genre: "Sports",
    logo: steam(252950, "logo.png"),
    art: steam(252950, "library_hero.jpg"),
    accent: "#55a9e8",
    officialUrl: "https://www.rocketleague.com/competitive/schedule",
    broadcasts: [
      twitch("Rocket League Championship Series", "RocketLeague"),
      youtube("Rocket League", "user/RocketLeagueGame"),
    ],
  },
  {
    id: "r6",
    name: "Rainbow Six Siege",
    shortName: "Rainbow Six",
    genre: "Tactical shooter",
    logo: steam(359550, "logo.png"),
    art: steam(359550, "library_hero.jpg"),
    accent: "#71bfce",
    officialUrl: "https://www.ubisoft.com/en-us/esports/rainbow-six/siege",
    broadcasts: [twitch("Rainbow Six Esports", "Rainbow6")],
  },
  {
    id: "overwatch",
    name: "Overwatch",
    shortName: "Overwatch",
    genre: "Hero shooter",
    logo: "/sports/logos/overwatch.png",
    art: steam(2357570, "library_hero.jpg"),
    accent: "#f99d2a",
    officialUrl: "https://esports.overwatch.com/schedule",
    broadcasts: [
      twitch("Overwatch Esports", "ow_esports"),
      youtube("Overwatch Esports", "@OW_esports"),
    ],
  },
  {
    id: "cod",
    name: "Call of Duty",
    shortName: "Call of Duty",
    genre: "Shooter",
    logo: steam(1938090, "logo.png"),
    art: steam(1938090, "library_hero.jpg"),
    accent: "#91b274",
    officialUrl: "https://callofdutyleague.com/en-us/",
    broadcasts: [twitch("Call of Duty", "CallofDuty"), youtube("Call of Duty League", "CODLeague")],
  },
  {
    id: "apex",
    name: "Apex Legends",
    shortName: "Apex",
    genre: "Battle royale",
    logo: steam(1172470, "logo.png"),
    art: steam(1172470, "library_hero.jpg"),
    accent: "#c56a68",
    officialUrl: "https://algs.ea.com/en",
    broadcasts: [
      twitch("Apex Legends Global Series", "playapex"),
      youtube("Apex Legends", "playapex"),
    ],
  },
  {
    id: "pubg",
    name: "PUBG: Battlegrounds",
    shortName: "PUBG",
    genre: "Battle royale",
    logo: steam(578080, "logo.png"),
    art: steam(578080, "library_hero.jpg"),
    accent: "#e7b34c",
    officialUrl: "https://pubgesports.com/en",
    broadcasts: [youtube("PUBG Esports", "c/PUBGEsports")],
  },
  {
    id: "fortnite",
    name: "Fortnite",
    shortName: "Fortnite",
    genre: "Battle royale",
    logo: "https://cms-assets.unrealengine.com/AVzjeqAbLRKi3W5jq0CAvz/ovBnvmuJSxO5xtgXZcef",
    art: "https://cms-assets.unrealengine.com/AKtZh9UPWT5uJzqgfWYCRz/cmlrx2er40xb606n2w5i3oea6",
    accent: "#ac84e5",
    officialUrl: "https://www.fortnite.com/competitive/schedule",
    broadcasts: [
      twitch("Fortnite Competitive", "fortnite"),
      youtube("Fortnite Competitive", "@FN_Competitive"),
    ],
  },
  {
    id: "starcraft2",
    name: "StarCraft II",
    shortName: "StarCraft II",
    genre: "Strategy",
    logo: "https://blz-contentstack-images.akamaized.net/v3/assets/blt72f16e066f85e164/blt167976541c434de1/64b80296a4648b1c1476cbfe/SC2_Logo.png",
    art: "https://blz-contentstack-images.akamaized.net/v3/assets/blt9c12f249ac15c7ec/bltbe2068a317e02d9f/6966bac0fb2fd910dbda4a26/og_image.webp",
    accent: "#7ab8ed",
    officialUrl: "https://starcraft2.blizzard.com/en-us/",
    broadcasts: [twitch("ESL StarCraft II", "ESL_SC2")],
  },
];

export function esportsGame(id: string): EsportsGameDef | undefined {
  return ESPORTS_GAMES.find((game) => game.id === id);
}
