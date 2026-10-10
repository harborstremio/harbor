import { safeFetch } from "@/lib/safe-fetch";
import type { MusicArtistProfile } from "./artist-profile";

export type ArtistImage = {
  id: string;
  thumb: string;
  full: string;
  credit: string;
  title: string;
};

const COMMONS = "https://commons.wikimedia.org";
const MAX_IMAGES = 60;
const CATEGORY_LIMIT = 50;
const PICTURE = /\.(jpe?g|png|gif|webp)$/i;
const CACHE_MS = 30 * 60_000;

const cache = new Map<string, { until: number; value: ArtistImage[] }>();

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value !== null && typeof value === "object" ? (value as Obj) : {};
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

async function json(url: string, signal?: AbortSignal): Promise<Obj> {
  const response = await safeFetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Artist images are unavailable");
  return obj(await response.json());
}

function commonsFile(name: string): { thumb: string; full: string } {
  const encoded = encodeURIComponent(name.replace(/^File:/, ""));
  return {
    thumb: `${COMMONS}/wiki/Special:FilePath/${encoded}?width=420`,
    full: `${COMMONS}/wiki/Special:FilePath/${encoded}?width=1600`,
  };
}

async function commonsCategory(category: string, signal?: AbortSignal): Promise<ArtistImage[]> {
  const title = `Category:${category.replace(/ /g, "_")}`;
  const body = await json(
    `${COMMONS}/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(title)}` +
      `&cmtype=file&cmlimit=${CATEGORY_LIMIT}&format=json&origin=*`,
    signal,
  );
  return rows(obj(body.query).categorymembers).flatMap((row) => {
    const name = text(row.title);
    if (!name || !PICTURE.test(name)) return [];
    const urls = commonsFile(name);
    return [
      {
        id: `commons:${name}`,
        ...urls,
        credit: "Wikimedia Commons",
        title: name.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
      },
    ];
  });
}

async function wikidataImages(qid: string, signal?: AbortSignal): Promise<ArtistImage[]> {
  const body = await json(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, signal);
  const entity = obj(obj(body.entities)[qid]);
  const claims = obj(entity.claims);
  const named = (property: string) =>
    rows(claims[property])
      .map((claim) => text(obj(obj(claim.mainsnak).datavalue).value))
      .filter(Boolean);

  const found: ArtistImage[] = named("P18").map((name) => ({
    id: `wikidata:${name}`,
    ...commonsFile(name),
    credit: "Wikimedia Commons",
    title: name.replace(/\.[a-z0-9]+$/i, ""),
  }));

  const category = named("P373")[0];
  if (!category) return found;
  const more = await commonsCategory(category, signal).catch(() => [] as ArtistImage[]);
  return [...found, ...more];
}

async function tmdbImages(
  name: string,
  tmdbKey: string,
  signal?: AbortSignal,
): Promise<ArtistImage[]> {
  const search = await json(
    `https://api.themoviedb.org/3/search/person?api_key=${encodeURIComponent(tmdbKey)}` +
      `&query=${encodeURIComponent(name)}`,
    signal,
  );
  const person = rows(search.results)[0];
  const id = typeof person?.id === "number" ? person.id : null;
  if (!id) return [];
  const body = await json(
    `https://api.themoviedb.org/3/person/${id}/images?api_key=${encodeURIComponent(tmdbKey)}`,
    signal,
  );
  return rows(body.profiles).flatMap((row) => {
    const path = text(row.file_path);
    if (!path) return [];
    return [
      {
        id: `tmdb:${path}`,
        thumb: `https://image.tmdb.org/t/p/w342${path}`,
        full: `https://image.tmdb.org/t/p/original${path}`,
        credit: "TMDB",
        title: name,
      },
    ];
  });
}

export async function loadArtistGallery(
  profile: MusicArtistProfile,
  tmdbKey?: string,
  signal?: AbortSignal,
): Promise<ArtistImage[]> {
  const key = `${profile.id}|${profile.wikidataId ?? ""}|${tmdbKey ? "t" : ""}`;
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;

  const lanes: Promise<ArtistImage[]>[] = [];
  if (profile.wikidataId)
    lanes.push(wikidataImages(profile.wikidataId, signal).catch(() => [] as ArtistImage[]));
  if (tmdbKey)
    lanes.push(tmdbImages(profile.name, tmdbKey, signal).catch(() => [] as ArtistImage[]));

  const lead: ArtistImage[] = profile.artwork
    ? [
        {
          id: `portrait:${profile.artwork}`,
          thumb: profile.artwork,
          full: profile.artwork,
          credit: "",
          title: profile.name,
        },
      ]
    : [];

  const pages = await Promise.all(lanes);
  const seen = new Set<string>();
  const images: ArtistImage[] = [];
  for (const image of [...lead, ...pages.flat()]) {
    if (seen.has(image.full) || images.length >= MAX_IMAGES) continue;
    seen.add(image.full);
    images.push(image);
  }
  cache.set(key, { until: Date.now() + CACHE_MS, value: images });
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
  return images;
}
