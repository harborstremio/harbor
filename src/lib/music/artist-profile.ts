import { MUSICBRAINZ_HEADERS, scheduleMusicBrainzRequest } from "./recording-profile";
import { rememberArtistGenres } from "./artist-genre-cache";
import { safeFetch } from "@/lib/safe-fetch";
import { artistIdentityKey } from "./artist-authority";
import { musicSourceLink } from "./source-link";
import type { MusicArtistRef } from "./types";

type Obj = Record<string, any>;
export type ArtistLink = {
  url: string;
  kind: "store" | "merch" | "official" | "source" | "tour" | "social";
  name: string;
};
export type MusicArtistProfile = {
  id: string;
  name: string;
  origin?: string;
  began?: string;
  ended?: string;
  aliases: string[];
  genres: string[];
  members: MusicArtistRef[];
  links: ArtistLink[];
  biography?: string;
  biographyUrl?: string;
  artwork?: string;
  wikidataId?: string;
  sources: MusicArtistRef[];
};
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const SOCIAL_HOSTS = /^(facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|threads\.net)$/;
export const artistNameKey = (name: string) => artistIdentityKey(name);
const object = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 300) : "");
const array = (value: unknown): Obj[] =>
  Array.isArray(value) ? value.slice(0, 200).map(object) : [];
const cache = new Map<string, { until: number; data: unknown }>();
const identities = new Map<string, string>();
let urlLookupBackoff = 0;

function publicUrl(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

async function json(url: string, signal?: AbortSignal): Promise<Obj> {
  signal?.throwIfAborted();
  const saved = cache.get(url);
  if (saved && saved.until > Date.now()) return object(saved.data);
  const fetchValue = async () => {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 9000);
    try {
      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: url.startsWith("https://musicbrainz.org/") ? MUSICBRAINZ_HEADERS : { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Artist metadata is unavailable");
      const value = object(await response.json());
      if (value.error) throw new Error("Artist metadata is unavailable");
      cache.set(url, { until: Date.now() + 30 * 60_000, data: value });
      while (cache.size > 150) cache.delete(cache.keys().next().value!);
      return value;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
  if (!url.startsWith("https://musicbrainz.org/")) return fetchValue();
  return scheduleMusicBrainzRequest(fetchValue, signal);
}

function sourceRef(url: string, name: string): MusicArtistRef | null {
  const u = new URL(url);
  if (/(^|\.)deezer\.com$/.test(u.hostname)) {
    const id = /\/(?:[a-z]{2}\/)?artist\/(\d+)\/?$/.exec(u.pathname)?.[1];
    if (id) return { id: `deezer:artist:${id}`, connectorId: "catalog", name };
  }
  if (u.hostname === "open.spotify.com") {
    const id = /^\/artist\/([a-z\d]{22})\/?$/i.exec(u.pathname)?.[1];
    if (id) return { id: `spotify:artist:${id}`, connectorId: "spotify", name };
  }
  if (/(^|\.)youtube\.com$/.test(u.hostname)) {
    const id = /^\/channel\/(UC[\w-]{22})\/?$/.exec(u.pathname)?.[1];
    if (id) return { id, connectorId: "youtube", name };
  }
  return null;
}

export function parseArtistProfile(value: unknown, id: string): MusicArtistProfile | null {
  const data = object(value);
  if (!uuid.test(id) || data.id !== id || !text(data.name)) return null;
  const profile: MusicArtistProfile = {
    id,
    name: text(data.name),
    origin: text(object(data["begin-area"]).name) || text(object(data.area).name),
    began: text(object(data["life-span"]).begin),
    ended: text(object(data["life-span"]).end),
    aliases: [
      ...new Set(
        array(data.aliases)
          .map((entry) => text(entry.name))
          .filter((name) => name && artistNameKey(name) !== artistNameKey(data.name)),
      ),
    ].slice(0, 5),
    genres: array(data.genres)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .map((entry) => text(entry.name))
      .filter(Boolean)
      .slice(0, 8),
    links: [],
    members: [],
    sources: [],
  };
  const seen = new Set<string>();
  for (const relation of array(data.relations)) {
    const target = object(relation.artist);
    if (
      ["member of band", "collaboration"].includes(relation.type) &&
      uuid.test(target.id ?? "") &&
      !profile.members.some((member) => member.id.endsWith(target.id))
    ) {
      profile.members.push({
        id: `musicbrainz:artist:${target.id}`,
        connectorId: "catalog",
        name: text(target.name),
        subtitle: text(target.disambiguation),
      });
    }
    const url = publicUrl(object(relation.url).resource);
    if (!url || seen.has(url) || relation.ended) continue;
    seen.add(url);
    const source = sourceRef(url, profile.name);
    if (source) profile.sources.push(source);
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (["play.google.com", "music.google.com"].includes(host)) continue;
    const kind =
      relation.type === "merchandise"
        ? "merch"
        : /(^|\.)(songkick|bandsintown)\.com$/.test(host)
          ? "tour"
          : ["purchase for download", "purchase for mail-order", "patronage"].includes(
                relation.type,
              ) || host.endsWith(".bandcamp.com")
            ? "store"
            : relation.type === "official homepage"
              ? "official"
              : SOCIAL_HOSTS.test(host)
                ? "social"
                : source
                  ? "source"
                  : null;
    if (kind)
      profile.links.push({
        url,
        kind,
        name: source?.id.startsWith("deezer:")
          ? "Deezer"
          : source?.connectorId === "spotify"
            ? "Spotify"
            : source?.connectorId === "youtube"
              ? "YouTube Music"
              : host,
      });
  }
  profile.members = profile.members.slice(0, 12);
  const links = new Map<string, ArtistLink>();
  for (const link of profile.links) {
    const host = new URL(link.url).hostname.replace(/^www\./, "");
    const store = /\b(qobuz|7digital|beatport)\.com$/.exec(host)?.[0] ?? host;
    const key = link.kind === "source" ? `source:${link.name}` : `${link.kind}:${store}`;
    if (!links.has(key)) links.set(key, link);
  }
  profile.links = [...links.values()];
  profile.sources = [
    ...new Map(
      profile.sources.map((source) => [`${source.connectorId}:${source.id}`, source]),
    ).values(),
  ];
  return profile;
}

async function identity(ref: MusicArtistRef, signal?: AbortSignal): Promise<string | null> {
  const direct = /^musicbrainz:artist:(.+)$/.exec(ref.id)?.[1] ?? ref.musicBrainzId;
  if (direct && uuid.test(direct)) return direct;
  const link = musicSourceLink({ ...ref, kind: "artist" });
  if (!link || !["Deezer", "Spotify", "YouTube Music"].includes(link.name)) return null;
  const known = identities.get(link.url);
  if (known) return known;
  if (Date.now() > urlLookupBackoff) {
    try {
      const response = await json(
        `https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link.url)}&inc=artist-rels&fmt=json`,
        signal,
      );
      const ids = [
        ...new Set(
          array(response.relations)
            .map((rel) => object(rel.artist).id)
            .filter((id) => uuid.test(id ?? "")),
        ),
      ];
      if (ids.length === 1) {
        identities.set(link.url, ids[0]);
        return ids[0];
      }
    } catch {
      signal?.throwIfAborted();
      urlLookupBackoff = Date.now() + 60_000;
    }
  }
  // Some MusicBrainz deployments temporarily fail URL lookups. Search only finds
  // candidates; an exact linked provider identity is still required for a match.
  const query = `artist:"${ref.name.replace(/["\\]/g, "")}"`;
  const results = await json(
    `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
    signal,
  );
  for (const candidate of array(results.artists)
    .filter(
      (artist) =>
        artistNameKey(text(artist.name)) === artistNameKey(ref.name) && uuid.test(artist.id ?? ""),
    )
    .slice(0, 3)) {
    const value = await json(
      `https://musicbrainz.org/ws/2/artist/${candidate.id}?inc=url-rels%2Bartist-rels%2Bgenres%2Baliases&fmt=json`,
      signal,
    );
    const profile = parseArtistProfile(value, candidate.id);
    if (profile?.sources.some((source) => source.id === ref.id)) {
      identities.set(link.url, candidate.id);
      while (identities.size > 150) identities.delete(identities.keys().next().value!);
      return candidate.id;
    }
  }
  return null;
}

export async function loadArtistProfile(
  ref: MusicArtistRef,
  language = "en",
  signal?: AbortSignal,
  biography = true,
): Promise<MusicArtistProfile | null> {
  const id = await identity(ref, signal);
  if (!id) return null;
  const data = await json(
    `https://musicbrainz.org/ws/2/artist/${id}?inc=url-rels%2Bartist-rels%2Bgenres%2Baliases&fmt=json`,
    signal,
  );
  const profile = parseArtistProfile(data, id);
  if (!profile) return null;
  rememberArtistGenres(ref.name, profile.genres);
  if (!biography) return profile;
  const wiki = array(data.relations)
    .map((rel) => publicUrl(object(rel.url).resource))
    .find((url) => url && /^https:\/\/www.wikidata.org\/wiki\/Q\d+$/.test(url));
  if (!wiki) return profile;
  try {
    const qid = wiki.split("/").pop()!;
    const wd = object(
      object(
        (await json(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, signal))
          .entities,
      )[qid],
    );
    const claims = object(wd.claims);
    if (!array(claims.P434).some((claim) => object(object(claim.mainsnak).datavalue).value === id))
      return profile;
    const photo = array(claims.P18)
      .map((claim) => text(object(object(claim.mainsnak).datavalue).value))
      .find(Boolean);
    profile.wikidataId = qid;
    if (photo)
      profile.artwork = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo)}?width=1000`;
    const lang = /^[a-z]{2,3}$/.test(language.split("-")[0]) ? language.split("-")[0] : "en";
    const article = object(object(wd.sitelinks)[`${lang}wiki`] ?? object(wd.sitelinks).enwiki);
    const articleUrl = publicUrl(article.url);
    profile.biography = text(
      object(object(wd.descriptions)[lang] ?? object(wd.descriptions).en).value,
    );
    if (articleUrl && /^https:\/\/[a-z]{2,3}\.wikipedia\.org\//.test(articleUrl)) {
      const host = new URL(articleUrl).origin;
      const summary = await json(
        `${host}/api/rest_v1/page/summary/${encodeURIComponent(text(article.title))}`,
        signal,
      );
      if (summary.type !== "disambiguation") {
        profile.biography =
          typeof summary.extract === "string" ? summary.extract.slice(0, 1800) : profile.biography;
        profile.biographyUrl = articleUrl;
        const image =
          publicUrl(object(summary.originalimage).source) ??
          publicUrl(object(summary.thumbnail).source);
        if (image && new URL(image).hostname === "upload.wikimedia.org") profile.artwork = image;
      }
    }
  } catch {
    signal?.throwIfAborted();
  }
  return profile;
}
