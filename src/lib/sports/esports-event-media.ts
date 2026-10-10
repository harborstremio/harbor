import { idbCacheGet, idbCacheSet } from "../idb-cache";
import { CS2_MAPS } from "./cs2-maps";
import { ESPORTS_GAMES } from "./esports-catalog";
import type { EsportsGameId } from "./esports-feeds";
import { ESPORTS_MAPS, type EsportsGameKind } from "./esports-map-data";

export type EventMediaRead = (url: string) => Promise<unknown>;
export type EventMediaReadText = (url: string) => Promise<string>;
export type EventArt = { url: string; fallback?: string; source: string; sourceUrl?: string };
export type LicensedImage = {
  url: string;
  width?: number;
  licence: string;
  licenceUrl?: string;
  /** Rendered verbatim wherever the image appears when attributionRequired. */
  attribution?: string;
  attributionRequired: boolean;
  sourceUrl: string;
};
export type EventHero = {
  art: EventArt;
  photo?: LicensedImage;
  logo?: LicensedImage;
  credits: string[];
};
export type EventVideo = {
  id: string;
  title: string;
  url: string;
  image: string;
  imageFallback: string;
  published: string;
  channel: string;
  kind: "vod" | "highlight" | "video";
};
export type EventMapArt = EventArt & {
  id: string;
  name: string;
  sourceLabel?: string;
  referenceOnly?: boolean;
  matched: boolean;
};
export type EventMediaRequest = {
  game: EsportsGameId;
  name: string;
  edition?: string;
  venue?: string;
  city?: string;
  wikidataId?: string;
  youtubePlaylistId?: string;
};
export type ValorantMapIndex = {
  byCodename: Record<string, string>;
  byUuid: Record<string, { name: string; splash: string }>;
  at: number;
};
export type ValorantAgentIndex = Record<string, { uuid: string; name: string }>;

type Json = Record<string, unknown>;
const obj = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const rows = (value: unknown): Json[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const folded = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const alnum = (value: string) => folded(value).replace(/[^\p{L}\p{N}]+/gu, "");
const words = (value: string) => folded(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const plain = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
const table = (spec: string): Record<string, string> =>
  Object.fromEntries(spec.split(/\s+/).filter(Boolean).map((pair) => pair.split(":")));

// Hotlink policy from the media audit. Liquipedia bitmaps are fair-use or
// rights-holder-only grants and its CDN answers a foreign Referer with a shame
// banner that is itself a valid PNG. The PandaScore CDN republishes the same art
// under Liquipedia filenames, so the licence question travels with the asset.
// octane.gg no longer resolves at all.
const APPROVED_MEDIA_HOSTS = new Set(
  ("upload.wikimedia.org thumb.wikimedia.org commons.wikimedia.org shared.akamai.steamstatic.com " +
    "cdn.cloudflare.steamstatic.com i.ytimg.com ddragon.leagueoflegends.com " +
    "raw.communitydragon.org media.valorant-api.com cmsassets.rgpub.io " +
    "files.bo3.gg image-proxy.bo3.gg " +
    "raw.githubusercontent.com cdn.jsdelivr.net www.opendota.com").split(" "),
);
const FORBIDDEN_MEDIA = [/(^|\.)liquipedia\.net$/i, /(^|\.)pandascore\.co$/i, /(^|\.)octane\.gg$/i];

/** "" for anything outside the approved set, so every caller falls through to art. */
export function approvedEventMedia(candidate: string): string {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (FORBIDDEN_MEDIA.some((pattern) => pattern.test(url.hostname))) return "";
    if (!APPROVED_MEDIA_HOSTS.has(url.hostname)) return "";
    if (!/\.(?:png|jpe?g|webp|gif|svg)$/i.test(url.pathname)) return "";
    // Commons appends campaign parameters its terms require be kept, so the
    // whole href survives: never rebuild one of these URLs from its parts.
    return url.href;
  } catch {
    return "";
  }
}

const STEAM_APPS: Partial<Record<EsportsGameId, number>> =
  { cs2: 730, dota2: 570, rocketleague: 252950 };
const GAMES = new Map(ESPORTS_GAMES.map((game) => [game.id, game]));

/** The floor of every chain below: a publisher backdrop that is always present. */
export function esportsEventGameArt(game: EsportsGameId): EventArt {
  const def = GAMES.get(game);
  const app = STEAM_APPS[game];
  const steam = app
    ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${app}/header.jpg`
    : "";
  const primary = approvedEventMedia(def?.art || "") || steam;
  return {
    url: primary || steam,
    fallback: primary === steam ? undefined : steam || undefined,
    source: def?.name || game,
    sourceUrl: def?.officialUrl,
  };
}

const COMMONS_META =
  "LicenseShortName|UsageTerms|AttributionRequired|LicenseUrl|Artist|Credit|Restrictions";
const REUSABLE_LICENCE = /^(?:cc0?\b|cc[ -]by|public domain|pd\b|no restrictions|attribution)/i;
const LOGO_TITLE = /logo|wordmark|icon|emblem|flag|\bmap of\b|poster|svg$/i;
const mediaWikiApi = (host: string, params: Record<string, string>) =>
  `https://${host}/w/api.php?${new URLSearchParams({ format: "json", ...params })}`;
// iiurlwidth above the original comes back as the unscaled original, so the
// reported thumbwidth is the only trustworthy size.
const commonsApi = (params: Record<string, string>) =>
  mediaWikiApi("commons.wikimedia.org", {
    action: "query",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1280",
    iiextmetadatafilter: COMMONS_META,
    ...params,
  });
const commonsPages = async (read: EventMediaRead, params: Record<string, string>) =>
  rows(obj(obj(await read(commonsApi(params))).query).pages).filter((page) => !page.missing);

/** Licence gate: an unreadable licence, any restriction, or a credit that cannot
 *  be satisfied all reject. A rejected file is never shown uncredited instead. */
function licensedCommonsImage(page: Json): LicensedImage | null {
  const info = rows(page.imageinfo)[0];
  if (!info) return null;
  const meta = obj(info.extmetadata);
  const field = (key: string) => text(obj(meta[key]).value);
  if (field("Restrictions")) return null;
  const licence = plain(field("LicenseShortName") || field("UsageTerms"));
  if (!REUSABLE_LICENCE.test(licence)) return null;
  const attribution = plain(field("Artist") || field("Credit"));
  const required = field("AttributionRequired").toLowerCase() === "true";
  if (required && !attribution) return null;
  const url = approvedEventMedia(text(info.thumburl) || text(info.url));
  if (!url) return null;
  const title = text(page.title);
  return {
    url,
    width: Number(info.thumbwidth) || Number(info.width) || undefined,
    licence,
    licenceUrl: field("LicenseUrl") || undefined,
    attribution: attribution || undefined,
    attributionRequired: required,
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  };
}

/** Arena and crowd photography, so an event reads as a venue and not a lockup. */
export async function commonsEventPhoto(
  request: EventMediaRequest,
  read: EventMediaRead,
): Promise<LicensedImage | null> {
  const venue = [request.venue, request.city].filter(Boolean).join(" ").trim();
  const event = [request.name, request.edition].filter(Boolean).join(" ").trim();
  // A hero crops out of a landscape original; a tall file reads as a portrait.
  const score = (page: Json) => {
    const info = rows(page.imageinfo)[0];
    const wide = Number(info.width) >= Number(info.height) ? 2 : 0;
    return wide + (Number(info.width) >= 1280 ? 1 : 0);
  };
  for (const term of [venue, event].filter(Boolean)) {
    const best = (
      await commonsPages(read, {
        generator: "search",
        gsrsearch: `filetype:bitmap ${term}`,
        gsrnamespace: "6",
        gsrlimit: "12",
      })
    )
      .filter((page) => page.ns === 6 && !LOGO_TITLE.test(text(page.title)))
      .sort((a, b) => score(b) - score(a))
      .map(licensedCommonsImage)
      .find(Boolean);
    if (best) return best;
  }
  return null;
}

const QID = /^Q[1-9]\d{0,11}$/;

/** Wikidata P154 then P18, resolved through the same Commons licence gate. */
export async function wikidataEventLogo(
  request: EventMediaRequest,
  read: EventMediaRead,
): Promise<LicensedImage | null> {
  const wanted = [request.name, request.edition].filter(Boolean).join(" ");
  let qid = QID.test(request.wikidataId || "") ? request.wikidataId! : "";
  if (!qid) {
    const search = mediaWikiApi("www.wikidata.org", {
      action: "wbsearchentities",
      language: "en",
      type: "item",
      limit: "5",
      search: wanted,
    });
    // A namesake entity must never supply an event's logo.
    const hits = rows(obj(await read(search)).search);
    qid = text(hits.find((hit) => words(text(hit.label)) === words(wanted))?.id);
    if (!QID.test(qid)) return null;
  }
  const entity = obj(
    obj(obj(await read(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).entities)[
      qid
    ],
  );
  const claims = obj(entity.claims);
  const file = ["P154", "P18"]
    .flatMap((property) =>
      rows(claims[property]).map((claim) => text(obj(obj(claim.mainsnak).datavalue).value)),
    )
    .find(Boolean);
  if (!file) return null;
  const page = (await commonsPages(read, { titles: `File:${file.replace(/^File:/, "")}` }))[0];
  return page ? licensedCommonsImage(page) : null;
}

/** Commons photograph, then the Wikidata logo, then publisher art. Never empty. */
export async function resolveEventHero(
  request: EventMediaRequest,
  read: EventMediaRead,
): Promise<EventHero> {
  const [photo, logo] = await Promise.all([
    commonsEventPhoto(request, read).catch(() => null),
    wikidataEventLogo(request, read).catch(() => null),
  ]);
  const credits = [photo, logo]
    .filter((image): image is LicensedImage => !!image?.attributionRequired)
    .map((image) => `${image.attribution} (${image.licence})`);
  return {
    art: esportsEventGameArt(request.game),
    photo: photo || undefined,
    logo: logo || undefined,
    credits: [...new Set(credits)],
  };
}

const PLAYLIST_ID = /^(?:PL|UU|FL|OL)[A-Za-z0-9_-]{10,50}$/;
const NAMED_ENTITY = table("amp:& lt:< gt:> quot:\" apos:'");
const xmlText = (value: string) =>
  value.replace(
    /&(?:#(\d{1,6})|#x([0-9a-fA-F]{1,5})|(amp|lt|gt|quot|apos));/g,
    (_match, dec: string, hex: string, named: string) =>
      dec
        ? String.fromCodePoint(Number(dec))
        : hex
          ? String.fromCodePoint(parseInt(hex, 16))
          : (NAMED_ENTITY[named.toLowerCase()] ?? ""),
  );
const xmlTag = (xml: string, name: string) =>
  xmlText(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1]?.trim() || "");

export const eventPlaylistFeedUrl = (playlistId: string) =>
  PLAYLIST_ID.test(playlistId)
    ? `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
    : "";

/** A playlist feed is not a channel feed: its entries carry the uploading
 *  channel, so gating on one channel id would silently drop co-hosted VODs.
 *  Every feed stops at 15 entries with no continuation, so a long event's VOD
 *  list is incomplete by design. */
export function parseEventPlaylistFeed(xml: string, playlistId: string): EventVideo[] {
  if (xml.length > 600_000 || !/<feed\b/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) return [];
  if (!PLAYLIST_ID.test(playlistId)) return [];
  const head = xml.slice(0, xml.indexOf("<entry") + 1 || undefined);
  const declared = xmlTag(head, "yt:playlistId");
  if (declared && declared !== playlistId) return [];
  const feedTitle = xmlTag(head, "title").slice(0, 120);
  const seen = new Set<string>();
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)]
    .slice(0, 15)
    .flatMap(([, entry]) => {
      const id = xmlTag(entry, "yt:videoId");
      const title = xmlTag(entry, "title").slice(0, 300);
      const published = xmlTag(entry, "published");
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || seen.has(id)) return [];
      if (!title || !Number.isFinite(Date.parse(published))) return [];
      seen.add(id);
      return [
        {
          id,
          title,
          url: `https://www.youtube.com/watch?v=${id}`,
          // maxres is absent on older uploads; hqdefault is generated for all.
          image: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
          imageFallback: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          published,
          channel: xmlTag(entry, "name").slice(0, 120) || feedTitle,
          kind: /highlight|best (?:of|plays)|top \d+/i.test(title)
            ? ("highlight" as const)
            : /\bvod\b|full (?:match|game|series)|\b(?:map|game) \d\b|\bbo[35]\b/i.test(title)
              ? ("vod" as const)
              : ("video" as const),
        },
      ];
    })
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

/** Zero quota and keyless, but a playlist id cannot be discovered keylessly: it
 *  is curated per event, so an absent id is an empty wall and not an error. */
export async function fetchEventVideos(
  request: EventMediaRequest,
  readText: EventMediaReadText,
): Promise<EventVideo[]> {
  const url = eventPlaylistFeedUrl(request.youtubePlaylistId || "");
  if (!url) return [];
  try {
    return parseEventPlaylistFeed(await readText(url), request.youtubePlaylistId!);
  } catch {
    return [];
  }
}

// ESPORTS_MAPS is keyed "dota" where the feed union says "dota2".
const MAP_KIND: Record<EsportsGameId, EsportsGameKind> = {
  cs2: "cs2",
  dota2: "dota",
  lol: "lol",
  valorant: "valorant",
  rocketleague: "rocketleague",
};
// Riot ships internal codenames where the catalog holds display names, so an
// untranslated Riot map name misses every join and renders nothing at all.
// These six pairs are the measured ones; valorantMapIndex extends them live.
const VALORANT_CODENAMES = table(
  "bonsai:Split canyon:Fracture duality:Bind foxtrot:Breeze port:Icebox triad:Haven",
);
const CACHE_TTL = 7 * 86_400_000;
let valorantMaps: Promise<ValorantMapIndex> | null = null;
let valorantAgents: Promise<ValorantAgentIndex> | null = null;

export function resetEventMediaCaches(): void {
  valorantMaps = null;
  valorantAgents = null;
}

/** Durable because the localStorage budget is spent; absent IndexedDB is fine. */
async function cached<T>(key: string, build: () => Promise<T>, floor: T): Promise<T> {
  const entry = await idbCacheGet(key).catch(() => null);
  if (entry && Date.now() - entry.at < CACHE_TTL && entry.data) return entry.data as T;
  try {
    const built = await build();
    await idbCacheSet(key, { at: Date.now(), data: built }).catch(() => undefined);
    return built;
  } catch {
    return floor;
  }
}

/** Keyed on uuid and codename. "The Range" appears twice with different uuids,
 *  so a displayName key would collapse two distinct rows into one. */
export async function valorantMapIndex(read: EventMediaRead): Promise<ValorantMapIndex> {
  const floor: ValorantMapIndex = { byCodename: { ...VALORANT_CODENAMES }, byUuid: {}, at: 0 };
  valorantMaps ??= cached(
    "esports-media:valorant-maps",
    async () => {
      const index: ValorantMapIndex = {
        byCodename: { ...VALORANT_CODENAMES },
        byUuid: {},
        at: Date.now(),
      };
      for (const map of rows(obj(await read("https://valorant-api.com/v1/maps")).data)) {
        const uuid = text(map.uuid);
        const name = text(map.displayName);
        if (!uuid || !name) continue;
        const splash = approvedEventMedia(text(map.splash) || text(map.displayIcon));
        if (index.byUuid[uuid]?.splash && !splash) continue;
        index.byUuid[uuid] = { name, splash };
        const codename = alnum(text(map.mapUrl).split("/").filter(Boolean).pop() || "");
        if (codename && splash) index.byCodename[codename] = name;
      }
      return index;
    },
    floor,
  );
  return valorantMaps.catch(() => floor);
}

/** A codename, a display name, a uuid or an unknown string all come back usable. */
export function valorantMapName(raw: string, index?: ValorantMapIndex): string {
  const key = alnum(raw);
  if (!key) return raw.trim();
  const codenames = index?.byCodename ?? VALORANT_CODENAMES;
  return codenames[key] ?? index?.byUuid[raw.trim().toLowerCase()]?.name ?? raw.trim();
}

/** Map art joined to the in-tree catalogs. An unmatched name still paints.
 *  A VALORANT caller resolves valorantMapIndex first: without it only the six
 *  measured codenames translate and the rest read as unmatched. */
export function eventMapArt(
  game: EsportsGameId,
  names: string[],
  index?: ValorantMapIndex,
): EventMapArt[] {
  const art = esportsEventGameArt(game);
  const defs = game === "cs2" ? CS2_MAPS : ESPORTS_MAPS[MAP_KIND[game]];
  const seen = new Set<string>();
  return names.flatMap((raw) => {
    const display = game === "valorant" ? valorantMapName(raw, index) : raw.trim();
    const key = alnum(display);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const def = defs.find((entry) => alnum(entry.name) === key || alnum(entry.id) === key);
    const url = approvedEventMedia(def?.image || "");
    const fallback = approvedEventMedia(def?.fallbackImage || "");
    return [
      {
        id: def?.id || key,
        name: def?.name || display,
        url: url || fallback || art.url,
        fallback: url ? fallback || art.url : art.url,
        source: def?.source || art.source,
        sourceUrl: def?.source || art.sourceUrl,
        sourceLabel: def?.sourceLabel,
        referenceOnly: def?.referenceOnly,
        matched: !!def && !!(url || fallback),
      },
    ];
  });
}

/** Verified current at the time of the media audit. Splash and loading paths
 *  carry no version segment, while the square portrait does. */
export const DDRAGON_VERSION = "16.19.1";
const LOL_CHAMPION_IDS = table(
  "chogath:Chogath kaisa:Kaisa khazix:Khazix velkoz:Velkoz belveth:Belveth jarvaniv:JarvanIV " +
    "nunu:Nunu nunuwillump:Nunu wukong:MonkeyKing monkeyking:MonkeyKing renata:Renata " +
    "renataglasc:Renata reksai:RekSai ksante:KSante drmundo:DrMundo leblanc:Leblanc",
);

export function dataDragonChampionId(champion: string): string {
  const trimmed = champion.trim();
  const alias = LOL_CHAMPION_IDS[alnum(trimmed)];
  if (alias) return alias;
  // An id that already carries inner capitals is passed through: these paths
  // are case sensitive and re-casing one turns it into a 403.
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const letters = word.replace(/[^A-Za-z0-9]/g, "");
      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    })
    .join("");
}

export function lolChampionArt(
  champion: string,
  kind: "splash" | "loading" | "square" = "splash",
  version = DDRAGON_VERSION,
): EventArt {
  const art = esportsEventGameArt("lol");
  const id = dataDragonChampionId(champion);
  const square = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
  const wide = `https://ddragon.leagueoflegends.com/cdn/img/champion/${kind}/${id}_0.jpg`;
  const primary = id ? approvedEventMedia(kind === "square" ? square : wide) : "";
  return {
    url: primary || art.url,
    fallback: primary ? approvedEventMedia(square) || art.url : art.url,
    source: "Riot Data Dragon",
    sourceUrl: "https://developer.riotgames.com/docs/lol",
  };
}

/** valorant-api has no name-addressable asset path, so the uuid index is the join. */
export async function valorantAgentIndex(read: EventMediaRead): Promise<ValorantAgentIndex> {
  valorantAgents ??= cached(
    "esports-media:valorant-agents",
    async () => {
      const index: ValorantAgentIndex = {};
      const url = "https://valorant-api.com/v1/agents?isPlayableCharacter=true";
      for (const agent of rows(obj(await read(url)).data)) {
        const uuid = text(agent.uuid);
        const name = text(agent.displayName);
        if (uuid && name && agent.isPlayableCharacter !== false)
          index[alnum(name)] = { uuid, name };
      }
      return index;
    },
    {},
  );
  return valorantAgents.catch(() => ({}) as ValorantAgentIndex);
}

export function valorantAgentArt(agent: string, index?: ValorantAgentIndex): EventArt {
  const art = esportsEventGameArt("valorant");
  const uuid = index?.[alnum(agent)]?.uuid || "";
  const base = `https://media.valorant-api.com/agents/${uuid}`;
  const primary = uuid ? approvedEventMedia(`${base}/fullportrait.png`) : "";
  return {
    url: primary || art.url,
    fallback: primary ? approvedEventMedia(`${base}/displayicon.png`) || art.url : art.url,
    source: "valorant-api",
    sourceUrl: uuid ? `https://valorant-api.com/v1/agents/${uuid}` : undefined,
  };
}

// Valve's internal hero ids diverge from the published names on these heroes only.
const DOTA_HERO_IDS = table(
  "antimage:antimage queenofpain:queenofpain vengefulspirit:vengefulspirit naturesprophet:furion " +
    "windranger:windrunner zeus:zuus necrophos:necrolyte outworlddestroyer:obsidian_destroyer " +
    "timbersaw:shredder wraithking:skeleton_king magnus:magnataur shadowfiend:nevermore " +
    "clockwerk:rattletrap doom:doom_bringer io:wisp underlord:abyssal_underlord " +
    "treantprotector:treant centaurwarrunner:centaur lifestealer:life_stealer",
);

export function dotaHeroId(hero: string): string {
  const trimmed = hero.trim().replace(/^npc_dota_hero_/, "");
  return DOTA_HERO_IDS[alnum(trimmed)] ?? words(trimmed).replace(/ /g, "_");
}

/** Steam answers this CDN with a dota2.com allow-origin rather than a wildcard:
 *  safe for a plain img, never for a canvas read or a crossOrigin attribute. */
export function dotaHeroArt(hero: string): EventArt {
  const art = esportsEventGameArt("dota2");
  const id = dotaHeroId(hero);
  const base = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes";
  const primary = id ? approvedEventMedia(`${base}/${id}.png`) : "";
  return {
    url: primary || art.url,
    fallback: primary ? approvedEventMedia(`${base}/icons/${id}.png`) || art.url : art.url,
    source: "Dota 2",
    sourceUrl: "https://www.dota2.com/heroes",
  };
}
