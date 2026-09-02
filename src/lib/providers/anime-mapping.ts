import {
  aniZipByAnidb,
  aniZipByAnilist,
  aniZipByImdb,
  aniZipByKitsu,
  aniZipByMal,
  aniZipByTmdbTv,
  type AniZipMapping,
} from "@/lib/providers/anizip";
import { kitsuMainTvSeries } from "@/lib/providers/kitsu";
import { selectSiblingWindows, type AnimeListWindow } from "@/lib/streams/anime-identity-core";
import { mappingStore } from "./mapping-store";

const SIDE_ENTRY_TYPES = new Set(["ova", "ona", "special", "music"]);

async function preferMainTv(kitsuId: number, type?: string): Promise<number> {
  if (type && SIDE_ENTRY_TYPES.has(type.toLowerCase())) {
    const main = await kitsuMainTvSeries(kitsuId).catch(() => null);
    if (main != null) return main;
  }
  return kitsuId;
}

const ARM = "https://relations.yuna.moe/api/ids";
const ANIME_LIST_URL =
  "https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-master.xml";

const ARM_KITSU_KEY = "harbor.armkitsucache.v2";
const ANIDB_TVDB_KEY = "harbor.anidbtvdbcache";
const ARM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const XML_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ArmKitsuEntry = { mal?: number; anidb?: number; anilist?: number; t: number };

type AnidbMapCache = {
  tvdb: Record<string, number>;
  imdb: Record<string, string>;
  byTvdb?: Record<string, AnimeListWindow[]>;
  byImdb?: Record<string, AnimeListWindow[]>;
  t: number;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const inflightArm = new Map<number, Promise<ArmKitsuEntry | null>>();
const armKitsuCache = mappingStore<ArmKitsuEntry>(ARM_KITSU_KEY);

async function armFromKitsu(kitsuId: number): Promise<ArmKitsuEntry | null> {
  const hit = armKitsuCache.get(String(kitsuId));
  if (hit && Date.now() - hit.t < ARM_TTL_MS) return hit;
  const existing = inflightArm.get(kitsuId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const r = await fetch(`${ARM}?source=kitsu&id=${kitsuId}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { mal?: number; anidb?: number; anilist?: number };
      const entry: ArmKitsuEntry = {
        mal: j?.mal,
        anidb: j?.anidb,
        anilist: j?.anilist,
        t: Date.now(),
      };
      armKitsuCache.set(String(kitsuId), entry);
      return entry;
    } catch {
      return null;
    } finally {
      inflightArm.delete(kitsuId);
    }
  })();
  inflightArm.set(kitsuId, p);
  return p;
}

const EXT_KITSU_KEY = "harbor.extkitsucache.v2";
const inflightExt = new Map<string, Promise<number | null>>();
const extKitsuCache = mappingStore<{ kitsu: number | null; t: number }>(EXT_KITSU_KEY);

export async function externalToKitsu(source: string, id: number): Promise<number | null> {
  const key = `${source}:${id}`;
  const hit = extKitsuCache.get(key);
  if (hit && Date.now() - hit.t < ARM_TTL_MS) return hit.kitsu;
  const existing = inflightExt.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const r = await fetch(`${ARM}?source=${source}&id=${id}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { kitsu?: number };
      const kitsu = typeof j?.kitsu === "number" ? j.kitsu : null;
      extKitsuCache.set(key, { kitsu, t: Date.now() });
      return kitsu;
    } catch {
      return null;
    } finally {
      inflightExt.delete(key);
    }
  })();
  inflightExt.set(key, p);
  return p;
}

let xmlInflight: Promise<AnidbMapCache> | null = null;

export async function loadAnidbMaps(): Promise<AnidbMapCache> {
  const cached = readJson<AnidbMapCache | null>(ANIDB_TVDB_KEY, null);
  if (cached && cached.byTvdb && Date.now() - cached.t < XML_TTL_MS) return cached;
  if (xmlInflight) return xmlInflight;
  xmlInflight = (async () => {
    try {
      const r = await fetch(ANIME_LIST_URL);
      if (!r.ok) return cached ?? { tvdb: {}, imdb: {}, t: 0 };
      const text = await r.text();
      const tvdb: Record<string, number> = {};
      const imdb: Record<string, string> = {};
      const byTvdb: Record<string, AnimeListWindow[]> = {};
      const byImdb: Record<string, AnimeListWindow[]> = {};
      const re = /<anime\b([^>]*)>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const attrs = m[1];
        const anidbMatch = /\banidbid="(\d+)"/.exec(attrs);
        if (!anidbMatch) continue;
        const anidbId = anidbMatch[1];
        const tvdbMatch = /\btvdbid="([^"]+)"/.exec(attrs);
        let tvdbId: number | null = null;
        if (tvdbMatch) {
          const tv = tvdbMatch[1];
          if (tv && tv !== "unknown" && tv !== "movie" && tv !== "tba" && tv !== "hentai") {
            const n = Number(tv);
            if (Number.isFinite(n)) {
              tvdbId = n;
              if (!tvdb[anidbId]) tvdb[anidbId] = n;
            }
          }
        }
        const imdbMatch = /\bimdbid="(tt\d+)"/.exec(attrs);
        if (imdbMatch && !imdb[anidbId]) imdb[anidbId] = imdbMatch[1];

        // Season windows: which provider season of the shared series this
        // AniDB entry occupies. Absolute entries ("a") are skipped here.
        const seasonAttr =
          /\bdefaulttvdbseason="(\d+)"/.exec(attrs) ?? /\btmdbseason="(\d+)"/.exec(attrs);
        if (!seasonAttr) continue;
        const season = Number(seasonAttr[1]);
        if (!Number.isFinite(season)) continue;
        const offsetAttr = /\bepisodeoffset="(-?\d+)"/.exec(attrs);
        const windowEntry: AnimeListWindow = {
          anidbId: Number(anidbId),
          season,
          offset: offsetAttr ? Number(offsetAttr[1]) : 0,
        };
        const imdbKey = imdbMatch?.[1];
        if (tvdbId != null) {
          (byTvdb[String(tvdbId)] ??= []).push(windowEntry);
          if (imdbKey) (byImdb[imdbKey] ??= []).push(windowEntry);
        } else if (imdbKey) {
          (byImdb[imdbKey] ??= []).push(windowEntry);
        }
      }
      const out: AnidbMapCache = { tvdb, imdb, byTvdb, byImdb, t: Date.now() };
      writeJson(ANIDB_TVDB_KEY, out);
      return out;
    } catch {
      return cached ?? { tvdb: {}, imdb: {}, t: 0 };
    } finally {
      xmlInflight = null;
    }
  })();
  return xmlInflight;
}

export async function findSiblingAnidbEntries(
  provider: "tvdb" | "imdb",
  providerId: string,
  season: number,
  excludeAnidbId?: number | null,
): Promise<number[]> {
  const maps = await loadAnidbMaps();
  const bucket = provider === "tvdb" ? maps.byTvdb?.[providerId] : maps.byImdb?.[providerId];
  return selectSiblingWindows(bucket, season, excludeAnidbId);
}

export async function kitsuToTvdb(kitsuId: number): Promise<number | null> {
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  if (az?.mappings?.thetvdb_id) return az.mappings.thetvdb_id;
  const arm = await armFromKitsu(kitsuId);
  if (!arm?.anidb) return null;
  const maps = await loadAnidbMaps();
  return maps.tvdb[String(arm.anidb)] ?? null;
}

export async function kitsuToImdb(kitsuId: number): Promise<string | null> {
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  if (az?.mappings?.imdb_id) return az.mappings.imdb_id;
  const arm = await armFromKitsu(kitsuId);
  if (!arm?.anidb) return null;
  const maps = await loadAnidbMaps();
  return maps.imdb[String(arm.anidb)] ?? null;
}

export async function kitsuToAnidb(kitsuId: number): Promise<number | null> {
  const arm = await armFromKitsu(kitsuId);
  return arm?.anidb ?? null;
}

export async function kitsuToAnilist(kitsuId: number): Promise<number | null> {
  const arm = await armFromKitsu(kitsuId);
  if (arm?.anilist != null) return arm.anilist;
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  return az?.mappings?.anilist_id ?? null;
}

export async function kitsuToMal(kitsuId: number): Promise<number | null> {
  const arm = await armFromKitsu(kitsuId);
  if (arm?.mal != null) return arm.mal;
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  return az?.mappings?.mal_id ?? null;
}

const ARM_SRC_KEY = "harbor.armsrcmalcache.v2";
const inflightArmSrc = new Map<string, Promise<number | null>>();
const armSrcCache = mappingStore<{ mal: number | null; t: number }>(ARM_SRC_KEY);

async function armSourceToMal(source: "anilist" | "anidb", id: number): Promise<number | null> {
  const key = `${source}:${id}`;
  const hit = armSrcCache.get(key);
  if (hit && Date.now() - hit.t < ARM_TTL_MS) return hit.mal;
  const existing = inflightArmSrc.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const r = await fetch(`${ARM}?source=${source}&id=${id}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { mal?: number };
      const mal = j?.mal ?? null;
      if (mal != null) armSrcCache.set(key, { mal, t: Date.now() });
      return mal;
    } catch {
      return null;
    } finally {
      inflightArmSrc.delete(key);
    }
  })();
  inflightArmSrc.set(key, p);
  return p;
}

export async function anilistToMal(anilistId: number): Promise<number | null> {
  const viaArm = await armSourceToMal("anilist", anilistId);
  if (viaArm != null) return viaArm;
  const az = await aniZipByAnilist(anilistId).catch(() => null);
  return az?.mappings?.mal_id ?? null;
}

export async function anidbToMal(anidbId: number): Promise<number | null> {
  const viaArm = await armSourceToMal("anidb", anidbId);
  if (viaArm != null) return viaArm;
  const az = await aniZipByAnidb(anidbId).catch(() => null);
  return az?.mappings?.mal_id ?? null;
}

let imdbAnidbIndex: Record<string, number> | null = null;

export async function imdbToKitsu(imdbId: string): Promise<number | null> {
  if (!imdbId.startsWith("tt")) return null;
  const az = await aniZipByImdb(imdbId).catch(() => null);
  if (typeof az?.mappings?.kitsu_id === "number") {
    return preferMainTv(az.mappings.kitsu_id, (az.mappings as { type?: string }).type);
  }
  if (typeof az?.mappings?.anidb_id === "number") return externalToKitsu("anidb", az.mappings.anidb_id);
  const maps = await loadAnidbMaps();
  if (!imdbAnidbIndex) {
    const idx: Record<string, number> = {};
    for (const [anidb, imdb] of Object.entries(maps.imdb)) {
      const n = Number(anidb);
      if (Number.isFinite(n) && !(imdb in idx)) idx[imdb] = n;
    }
    imdbAnidbIndex = idx;
  }
  const anidb = imdbAnidbIndex[imdbId];
  if (!anidb) return null;
  return externalToKitsu("anidb", anidb);
}

export async function tmdbTvToKitsu(tmdbId: number): Promise<number | null> {
  const az = await aniZipByTmdbTv(tmdbId).catch(() => null);
  if (typeof az?.mappings?.kitsu_id === "number") {
    return preferMainTv(az.mappings.kitsu_id, (az.mappings as { type?: string }).type);
  }
  if (typeof az?.mappings?.anidb_id === "number") return externalToKitsu("anidb", az.mappings.anidb_id);
  return null;
}

export async function relatedLibraryIds(id: string): Promise<string[]> {
  let az: AniZipMapping | null = null;
  const anime = /^(kitsu|mal|anilist|anidb):(\d+)/.exec(id);
  if (anime) {
    const n = Number(anime[2]);
    az =
      anime[1] === "kitsu"
        ? await aniZipByKitsu(n).catch(() => null)
        : anime[1] === "anilist"
          ? await aniZipByAnilist(n).catch(() => null)
          : anime[1] === "mal"
            ? await aniZipByMal(n).catch(() => null)
            : await aniZipByAnidb(n).catch(() => null);
  } else if (/^tt\d+$/.test(id)) {
    az = await aniZipByImdb(id).catch(() => null);
  } else {
    const tv = /^tmdb:tv:(\d+)/.exec(id);
    if (tv) az = await aniZipByTmdbTv(Number(tv[1])).catch(() => null);
  }
  const mp = az?.mappings;
  if (!mp) return [];
  const out = new Set<string>();
  if (mp.imdb_id) out.add(mp.imdb_id);
  if (mp.themoviedb_id != null && String(mp.themoviedb_id).trim() !== "") {
    out.add(`tmdb:tv:${mp.themoviedb_id}`);
  }
  if (typeof mp.kitsu_id === "number") out.add(`kitsu:${mp.kitsu_id}`);
  if (typeof mp.anilist_id === "number") out.add(`anilist:${mp.anilist_id}`);
  if (typeof mp.mal_id === "number") out.add(`mal:${mp.mal_id}`);
  if (typeof mp.anidb_id === "number") out.add(`anidb:${mp.anidb_id}`);
  out.delete(id);
  return [...out];
}
