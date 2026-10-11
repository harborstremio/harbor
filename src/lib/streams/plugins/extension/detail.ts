import type { Meta, MetaType } from "@/lib/cinemeta";
import { bridgeLoad, extensionsSupported, type BridgeMedia } from "./bridge";
import { readListing } from "./listing";
import { normalizeTitle } from "./match";
import { metaType } from "./meta-type";

export const CAPSTAN_ID_PREFIX = "capstan:";

const MAX_CAST = 20;
const MAX_RECOMMENDATIONS = 20;
const MAX_NAME = 300;

export function isCapstanId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(CAPSTAN_ID_PREFIX);
}

/** The pair to [parseCapstanId]; both halves are encoded so neither can impersonate the colon
 * that separates them. */
export function capstanId(providerId: string, url: string): string {
  return `${CAPSTAN_ID_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(url)}`;
}

/** A browse surface persists one string per item, so a plugin's row folds its provider and the
 * item's own url into this id. Both halves were encoded, and encodeURIComponent leaves no raw
 * colon behind, so the first colon after the prefix is the separator. */
export function parseCapstanId(id: string): { providerId: string; url: string } | null {
  if (!isCapstanId(id)) return null;
  const rest = id.slice(CAPSTAN_ID_PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut <= 0) return null;
  try {
    const providerId = decodeURIComponent(rest.slice(0, cut));
    // Episode stream ids append raw :season:episode after the encoded page. Strip that suffix
    // before decoding, so it never becomes part of the provider's URL.
    const url = decodeURIComponent(rest.slice(cut + 1).replace(/:\d+:\d+$/, ""));
    return providerId && url ? { providerId, url } : null;
  } catch {
    return null;
  }
}

/** What a provider knows about one of its own items, in the shapes the detail page already reads.
 * It carries no photo for a person, no logo, and no YouTube id for a trailer, so those stay empty
 * rather than being invented. */
export type CapstanDetail = {
  meta: Meta;
  /** The provider's age rating. `Meta` has no field of its own for one. */
  contentRating?: string;
  /** Provider-declared actor names, with no photos or roles to pair them with. */
  cast: string[];
  /** Other items the same provider offers, already addressed by their own ids. */
  recommendations: Meta[];
  /** An id the rest of Harbor can resolve this title by, or null when the provider named none. */
  canonicalId: string | null;
  /** What the provider said it returned. A catalogue can only guess this from the provider's
   * declared types, and that guess is the first type it lists, so this is the one to trust. */
  kind: "movie" | "series";
};

function text(v: unknown): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex -- Strip protocol control characters.
  return v.replace(/[\x00-\x1f\x7f]/g, "").trim();
}

function httpUrl(v: unknown): string | undefined {
  const s = text(v);
  return /^https?:\/\//i.test(s) ? s : undefined;
}

function yearOf(media: BridgeMedia): string | undefined {
  return typeof media.year === "number" && media.year > 0 ? String(media.year) : undefined;
}

function minutesOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

/** The provider picks the unit: a CloudStream episode date is millis for most sources and seconds
 * for a few. Epoch seconds only pass 1e11 in the year 5138, and epoch millis passed it in 1973, so
 * the two cannot be confused. */
function airDateIso(value: number | null | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  const date = new Date(value > 1e11 ? value : value * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Episodes keep the provider's own numbering, because playback re-finds them by season and
 * episode number rather than by anything an id could carry. */
function videosOf(media: BridgeMedia): Meta["videos"] {
  const episodes = Array.isArray(media.episodes) ? media.episodes : [];
  const out = episodes.map((ep) => {
    const description = text(ep.description) || undefined;
    return {
      season: ep.season ?? undefined,
      episode: ep.episode ?? undefined,
      name: text(ep.name) || undefined,
      title: text(ep.name) || undefined,
      overview: description,
      description,
      thumbnail: httpUrl(ep.posterUrl),
      runtime: minutesOf(ep.runtimeMinutes),
      released: airDateIso(ep.airDate),
    };
  });
  return out.length ? out : undefined;
}

function namesOf(actors: unknown): string[] {
  if (!Array.isArray(actors)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of actors) {
    const name = text(value);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name.slice(0, MAX_NAME));
    if (out.length >= MAX_CAST) break;
  }
  return out;
}

/** Its own rows are addressed the same way the catalogue addresses them, so a recommendation opens
 * the detail page for the item it names rather than searching for it afresh. */
function recommendationsOf(
  media: BridgeMedia,
  providerId: string,
  type: MetaType,
  origin: Meta["addonOrigin"],
): Meta[] {
  const items = Array.isArray(media.recommendations) ? media.recommendations : [];
  const out: Meta[] = [];
  for (const item of items) {
    if (out.length >= MAX_RECOMMENDATIONS) break;
    if (!item || typeof item !== "object") continue;
    const name = text(item.name).slice(0, MAX_NAME);
    const url = text(item.url);
    if (!name || !url) continue;
    // The provider's line, read the same way a catalogue row's is, so an item opened from a search
    // or a plugin page carries its languages through to the detail page.
    const read = readListing(name);
    out.push({
      id: capstanId(providerId, url),
      type: metaType(item.type, type),
      name: read.title.slice(0, MAX_NAME),
      poster: httpUrl(item.posterUrl),
      listingExtras: read.rest
        ? {
            rest: read.rest,
            languages: read.languages,
            quality: read.quality,
            resolutions: read.resolutions,
            hdr: read.hdr,
          }
        : undefined,
      listingYear: read.year ?? undefined,
      pluginQuality: text(item.quality).slice(0, 40) || read.resolutions[0] || undefined,
      addonOrigin: origin,
    });
  }
  return out;
}

const IMDB_ID_RX = /^tt\d{5,}$/;
const TMDB_ID_RX = /^\d+$/;

/** The id the rest of Harbor can resolve this title by, when the provider named one. The anime
 * schemes are deliberately not read: the path that consumes them is still closed to a native
 * addon, so an id handed to it would go nowhere. */
export function canonicalIdOf(syncIds: unknown, type: MetaType): string | null {
  if (!syncIds || typeof syncIds !== "object") return null;
  const ids = syncIds as Record<string, unknown>;
  const imdb = text(ids.imdbId);
  if (IMDB_ID_RX.test(imdb)) return imdb;
  const tmdb = text(ids.tmdbId);
  if (TMDB_ID_RX.test(tmdb)) return `tmdb:${type === "movie" ? "movie" : "tv"}:${tmdb}`;
  return null;
}

/** A declared id is only worth trusting when the record it points at is recognisably the same
 * title. The comparison runs one way: a provider names a row after everything it carries -- season
 * range, audio, quality, size -- so the resolved title has to be recognisable *inside* that name.
 * Counting the other way round lets the release notes outvote the title and refuse a correct id. */
export function titlesAgree(declared: string, resolved: string | null | undefined): boolean {
  const parts = (value: string) =>
    normalizeTitle(value)
      .split(" ")
      .filter((token) => token.length > 1);
  const held = new Set(parts(declared));
  const want = parts(resolved ?? "");
  if (!want.length || !held.size) return false;
  // A short title has to be matched almost whole, which is what keeps a sequel from passing as its
  // predecessor: "Dune" must not resolve as "Dune Part Two".
  return want.filter((token) => held.has(token)).length >= Math.ceil(want.length * 0.6);
}

/** A provider's own word for the kind outranks anything a catalogue could guess; when it names
 * nothing recognisable its episode list decides. An anime film is a film, which is the one place
 * this disagrees with the catalogue's map: that reads `animemovie` as `anime`. */
function kindOf(media: BridgeMedia, fallback: MetaType): "movie" | "series" {
  const key = String(media.type ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (key === "animemovie") return "movie";
  const named = metaType(media.type, "other");
  if (named === "series" || named === "anime") return "series";
  if (named === "movie") return "movie";
  const episodes = Array.isArray(media.episodes) ? media.episodes : [];
  if (episodes.length) return "series";
  return fallback === "series" ? "series" : "movie";
}

export function capstanDetailFrom(
  id: string,
  type: MetaType,
  media: BridgeMedia,
  origin?: Meta["addonOrigin"],
): CapstanDetail {
  const parsed = parseCapstanId(id);
  const duration = minutesOf(media.durationMinutes);
  const tags = Array.isArray(media.tags) ? media.tags.map(text).filter(Boolean) : [];
  // The provider's own line, read the same way a catalogue row's is. `media.name` is the title the
  // page was loaded under, which for these providers is the whole listing line: the languages and
  // quality are in it and nowhere else in the payload, so they are read back out here too.
  const listing = readListing(text(media.name));
  return {
    meta: {
      id,
      type,
      name: listing.title,
      poster: httpUrl(media.posterUrl),
      background: httpUrl(media.backgroundPosterUrl),
      description: text(media.plot) || undefined,
      releaseInfo: yearOf(media),
      runtime: duration != null ? `${duration} min` : undefined,
      genres: tags.length ? tags : undefined,
      videos: videosOf(media),
      listingExtras: listing.rest
        ? {
            rest: listing.rest,
            languages: listing.languages,
            quality: listing.quality,
            resolutions: listing.resolutions,
            hdr: listing.hdr,
          }
        : undefined,
      listingYear: listing.year ?? undefined,
    },
    contentRating: text(media.contentRating) || undefined,
    cast: namesOf(media.actors),
    recommendations: parsed ? recommendationsOf(media, parsed.providerId, type, origin) : [],
    canonicalId: canonicalIdOf(media.syncIds, type),
    kind: kindOf(media, type),
  };
}

/** What a load is remembered under, and asked for under. The type belongs in the key: what a
 * provider calls an item decides how its ids are read back and how its own episodes are typed,
 * so an answer built for one type is not an answer to a request made as another. */
function loadKey(id: string, type: MetaType): string {
  return `${type}|${id}`;
}

/** The loads in flight, so that two callers asking for the same item at once -- a strict-mode
 * double mount, or a second view opening the same row -- spend one bridge call rather than two.
 * The page a provider serves is not cheap to parse, and the plugin is charged for each one. */
const loading = new Map<string, Promise<CapstanDetail | null>>();

/** What a load answered, briefly. A surface that features an item reads its page to find the
 * artwork, and the detail page reads that same page moments later when the item is opened;
 * without this the plugin is charged twice for one look. Only a page a provider actually served
 * is kept -- a failure is left to be retried, because a page that is down now is often up again
 * on the next attempt. */
const RECENT_TTL_MS = 2 * 60_000;
const RECENT_MAX = 40;
const recent = new Map<string, { at: number; detail: CapstanDetail }>();

function remember(key: string, detail: CapstanDetail): void {
  recent.delete(key);
  recent.set(key, { at: Date.now(), detail });
  while (recent.size > RECENT_MAX) {
    const first = recent.keys().next().value;
    if (first === undefined) break;
    recent.delete(first);
  }
}

export async function loadCapstanDetail(
  id: string,
  type: MetaType,
  origin?: Meta["addonOrigin"],
): Promise<CapstanDetail | null> {
  const key = loadKey(id, type);
  const kept = recent.get(key);
  if (kept && Date.now() - kept.at < RECENT_TTL_MS) return kept.detail;
  const running = loading.get(key);
  if (running) return running;
  const parsed = parseCapstanId(id);
  if (!parsed || !extensionsSupported()) return null;
  const work = (async () => {
    const loaded = await bridgeLoad(parsed.providerId, parsed.url).catch(() => null);
    const media = loaded?.media;
    if (!media) return null;
    const detail = capstanDetailFrom(id, type, media, origin);
    remember(key, detail);
    return detail;
  })().finally(() => loading.delete(key));
  loading.set(key, work);
  return work;
}
