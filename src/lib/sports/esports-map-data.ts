import { CS2_MAPS } from "./cs2-maps";
import type { SportsGame } from "./espn-types";
import { EXTRA_ESPORTS_MAPS, type ExtraEsportsGameKind } from "./esports-extra-maps";

export type EsportsGameKind = "dota" | "lol" | "valorant" | "cs2" | ExtraEsportsGameKind;
export type EsportsMapDef = {
  id: string;
  name: string;
  image?: string;
  fallbackImage?: string;
  layers?: { name: string; image: string; fallbackImage?: string }[];
  source: string;
  referenceOnly?: boolean;
  sourceLabel?: string;
  blueprint?: string;
};
export type EsportsPlayer = {
  id: string;
  accountId?: string;
  name: string;
  hero: string;
  image?: string;
  side: "home" | "away";
  lane?: 1 | 2 | 3 | 4;
  kills?: number;
  deaths?: number;
  assists?: number;
  profileUrl?: string;
  stats?: { label: string; value: string }[];
};
export type EsportsRoster = {
  players: EsportsPlayer[];
  at: number;
  live: boolean;
  provider?: string;
  basis?: "match" | "current-team" | "unavailable";
  maps?: string[];
};

const RIOT_MAPS = "https://playvalorant.com/en-us/maps/";
const riotImage = (asset: string) =>
  `https://cmsassets.rgpub.io/sanity/images/dsfx7636/${asset}?accountingTag=VAL&auto=format&w=900`;
// Riot's own map explorer provides these overhead assets. They are reference maps,
// never presented as the selected competitive map without a provider map identifier.
export const ESPORTS_MAPS: Record<EsportsGameKind, EsportsMapDef[]> = {
  ...(Object.fromEntries(
    Object.entries(EXTRA_ESPORTS_MAPS).map(([kind, maps]) => [
      kind,
      maps.map((map) => ({
        id: map.id,
        name: map.name,
        image: map.image,
        source: map.sourceUrl,
        sourceLabel: map.sourceLabel,
        referenceOnly:
          !map.image && (!map.blueprintUrl || (map.blueprintBytes ?? 0) > 12 * 1024 * 1024),
        blueprint: (map.blueprintBytes ?? 0) <= 12 * 1024 * 1024 ? map.blueprintUrl : undefined,
      })),
    ]),
  ) as Record<ExtraEsportsGameKind, EsportsMapDef[]>),
  dota: [
    {
      id: "dota",
      name: "Dota 2 · 7.40",
      image: "https://www.opendota.com/assets/images/dota2/map/detailed_740.webp",
      source:
        "https://github.com/odota/web/blob/master/public/assets/images/dota2/map/detailed_740.webp",
    },
  ],
  lol: [
    {
      id: "summoners-rift",
      name: "Summoner’s Rift",
      image: "https://ddragon.leagueoflegends.com/cdn/16.18.1/img/map/map11.png",
      source: "https://developer.riotgames.com/docs/lol#data-dragon_other_minimaps",
    },
    {
      id: "howling-abyss",
      name: "Howling Abyss",
      image: "https://ddragon.leagueoflegends.com/cdn/16.18.1/img/map/map12.png",
      source: "https://developer.riotgames.com/docs/lol#data-dragon_other_minimaps",
    },
  ],
  valorant: [
    ["ascent", "Ascent", "news/a31ef0d024e1add0214eb49698ca13e58f62d17e-641x641.jpg"],
    ["haven", "Haven", "news/d9f3c040be38a8fc1f49f18d1221680419877c05-641x641.png"],
    ["bind", "Bind", "news/9c2f75aa4d00022c440615ce08988c7dd5f2bb00-641x641.png"],
    ["split", "Split", "news/dc8a607601339a6c79c8d144c93e17915cde8ac9-515x513.jpg"],
    ["icebox", "Icebox", "news/421063d481e9e1b2b5f2f834f53b7512f77413b9-2000x2000.jpg"],
    ["breeze", "Breeze", "news_live/5e9322e5270fea63d82e956ba7d4ccffe95eb84a-515x515.png"],
    ["fracture", "Fracture", "news/a96705f3a4df124c0dc296ef78e79e12c47ba46f-2000x2000.jpg"],
    ["pearl", "Pearl", "news_live/0c05fb9a4aa08553afb85842f91fad6f9d3fe87e-515x515.png"],
    ["lotus", "Lotus", "news_live/a660e638ac2a27d458ef22a6db17b3e372137d09-1873x1873.jpg"],
    ["sunset", "Sunset", "news/699c33a4ee5f5daf71e87c0f3bf6ddf6995b4bb3-2000x2000.jpg"],
    ["abyss", "Abyss", "news_live/b1ae562acab1582d664730cb619b655db8991ed5-515x515.png"],
    ["corrode", "Corrode", "news_live/90666c45369269a33eebddc363b250dbc7d61a34-515x515.jpg"],
    ["summit", "Summit", "news_live/36a3f67d05cd359fa6c3a4c1fea3ba6ed84cbc2e-515x515.jpg"],
  ].map(([id, name, asset]) => ({
    id,
    name,
    image: riotImage(asset),
    source: RIOT_MAPS,
  })),
  cs2: CS2_MAPS,
};

export function esportsGameKind(
  game: Pick<SportsGame, "league" | "context">,
): EsportsGameKind | undefined {
  const text = `${game.league} ${game.context?.name || ""}`;
  if (/dota/i.test(text)) return "dota";
  if (/valorant|\bVCT\b/i.test(text)) return "valorant";
  if (/counter.strike|\bCS2\b|\bCSGO\b|\bCS:GO\b/i.test(text)) return "cs2";
  if (/league of legends|\b(?:LCK|LEC|LPL|LCS|LOL|MSI)\b/i.test(text)) return "lol";
  if (/rocket.?league|\bRLCS\b/i.test(text)) return "rocketleague";
  if (/rainbow.?six|\bR6\b|\bR6S\b|\bSiege\b/i.test(text)) return "r6";
  if (/overwatch|\bOWCS\b|\bOWL\b|\bOW2\b/i.test(text)) return "overwatch";
  if (/call.?of.?duty|\bCOD\b|\bCDL\b/i.test(text)) return "cod";
  if (/apex|\bALGS\b/i.test(text)) return "apex";
  if (/pubg|battlegrounds|\bPGC\b|\bPGS\b/i.test(text)) return "pubg";
  if (/fortnite|\bFNCS\b/i.test(text)) return "fortnite";
  if (/starcraft|\bSC2\b|\bGSL\b/i.test(text)) return "starcraft2";
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const name = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");
const count = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;

export function parseDotaRoster(
  raw: unknown,
  heroes: unknown,
  live: boolean,
  now = Date.now(),
): EsportsRoster {
  const data = record(raw),
    heroData = record(heroes);
  if (
    live &&
    (typeof data.last_update_time !== "number" ||
      now - data.last_update_time * 1000 > 300_000 ||
      data.last_update_time * 1000 > now + 60_000)
  )
    return { players: [], at: now, live: false };
  const seen = new Set<string>();
  const players = (Array.isArray(data.players) ? data.players : []).slice(0, 20).flatMap((item) => {
    const player = record(item);
    const slot = count(player.player_slot),
      team = count(player.team);
    const side = live
      ? team === 0
        ? "home"
        : team === 1
          ? "away"
          : undefined
      : slot !== undefined
        ? slot < 128
          ? "home"
          : "away"
        : undefined;
    if (!side || (live ? count(player.team_slot) === undefined : slot === undefined)) return [];
    const id = `${side}:${live ? player.team_slot : slot}`;
    if (seen.has(id) || [...seen].filter((key) => key.startsWith(side)).length >= 5) return [];
    seen.add(id);
    const hero = record(heroData[String(player.hero_id)]);
    const heroPath = name(hero.img).split("?")[0];
    const image = /^\/apps\/dota2\/images\/[a-zA-Z0-9_./-]+\.png$/.test(heroPath)
      ? `https://cdn.cloudflare.steamstatic.com${heroPath}`
      : undefined;
    const lane = count(player.lane_role);
    return [
      {
        id,
        accountId:
          count(player.account_id) && Number(player.account_id) < 4_294_967_295
            ? String(player.account_id)
            : undefined,
        name: name(player.name) || name(player.personaname),
        hero: name(hero.localized_name),
        image,
        side,
        lane: !live && lane && lane <= 4 ? (lane as 1 | 2 | 3 | 4) : undefined,
        kills: count(player.kills),
        deaths: count(player.deaths),
        assists: count(player.assists),
      } satisfies EsportsPlayer,
    ];
  });
  return { players, at: now, live };
}

/** Coarse lane anchors only. These never represent current player coordinates. */
export function reportedLaneAnchor(
  player: Pick<EsportsPlayer, "side" | "lane">,
): { x: number; y: number } | undefined {
  if (!player.lane) return;
  const radiant = {
    1: { x: 74, y: 80 },
    2: { x: 43, y: 58 },
    3: { x: 21, y: 32 },
    4: { x: 30, y: 70 },
  };
  const point = radiant[player.lane];
  return player.side === "home" ? point : { x: 100 - point.x, y: 100 - point.y };
}

const rosterCache = new Map<string, EsportsRoster>();
let heroCache: { at: number; data: unknown } | undefined;
export async function fetchEsportsRoster(
  game: SportsGame,
  signal: AbortSignal,
  sourceUrl?: string,
): Promise<EsportsRoster> {
  const empty = { players: [], at: Date.now(), live: false };
  if (esportsGameKind(game) === "cs2" && sourceUrl) {
    const match = /^https:\/\/bo3\.gg\/matches\/([a-z0-9][a-z0-9-]{0,180})\/?$/.exec(sourceUrl);
    if (!match) return empty;
    const { fetchCsMatchDetail } = await import("./esports-cs-detail");
    const detail = await fetchCsMatchDetail(match[1], signal);
    const players = detail.teams.flatMap<EsportsPlayer>((team) => {
      const side =
        team.id === game.home.id ? "home" : team.id === game.away.id ? "away" : undefined;
      if (!side) return [];
      return team.players.map((player) => ({
        id: `${side}:${player.id}`,
        name: player.name,
        hero: player.fullName || "",
        image: player.image,
        side,
        stats: player.stats,
        profileUrl: player.url,
      }));
    });
    return {
      players,
      at: detail.fetchedAt,
      live: false,
      provider: "Bo3.gg",
      basis: detail.rosterBasis,
      maps: detail.maps
        .map((map) => `de_${map.name}`)
        .filter((id) => CS2_MAPS.some((map) => map.id === id)),
    };
  }
  if (
    game.league !== "DOTA2" ||
    game.source !== "opendota" ||
    game.state === "pre" ||
    !/^\d{1,20}$/.test(game.id)
  )
    return empty;
  const live = game.state === "in";
  const key = `${game.id}:${game.state}`;
  const hit = rosterCache.get(key);
  if (hit && Date.now() - hit.at < (live ? 45_000 : 3_600_000)) return hit;
  const { safeFetch } = await import("../safe-fetch");
  const json = async (path: string) => {
    signal.throwIfAborted();
    const response = await safeFetch(`https://api.opendota.com/api/${path}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
    });
    if (!response.ok) throw new Error("Esports roster is unavailable");
    return response.json() as Promise<unknown>;
  };
  const [raw, heroes] = await Promise.all([
    json(live ? "live" : `matches/${game.id}`),
    heroCache && Date.now() - heroCache.at < 86_400_000
      ? Promise.resolve(heroCache.data)
      : json("constants/heroes")
          .then((data) => {
            heroCache = { at: Date.now(), data };
            return data;
          })
          .catch(() => ({})),
  ]);
  signal.throwIfAborted();
  const match = live
    ? (Array.isArray(raw) ? raw : []).find((item) => String(record(item).match_id) === game.id)
    : String(record(raw).match_id) === game.id
      ? raw
      : null;
  const result = parseDotaRoster(match, heroes, live);
  rosterCache.delete(key);
  rosterCache.set(key, result);
  while (rosterCache.size > 30) rosterCache.delete(rosterCache.keys().next().value!);
  return result;
}
