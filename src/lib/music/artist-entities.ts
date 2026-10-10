import { safeFetch } from "@/lib/safe-fetch";
import { scheduleMusicBrainzRequest } from "./recording-profile";

export type ArtistEntities = {
  labels: { id: string; name: string }[];
  releases: string[];
};

const MB = "https://musicbrainz.org/ws/2";
const PAGE = 100;
const MAX_LABELS = 12;
const MAX_RELEASES = 40;
const CACHE_MS = 30 * 60_000;
const EMPTY: ArtistEntities = { labels: [], releases: [] };

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const cache = new Map<string, { until: number; value: ArtistEntities }>();

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value !== null && typeof value === "object" ? (value as Obj) : {};
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 200) : "");

export function artistMbid(id: string): string {
  const tail = id.split(":").pop() ?? "";
  return uuid.test(tail) ? tail : "";
}

export async function loadArtistEntities(
  artistId: string,
  signal?: AbortSignal,
): Promise<ArtistEntities> {
  const mbid = artistMbid(artistId);
  if (!mbid) return EMPTY;
  const saved = cache.get(mbid);
  if (saved && saved.until > Date.now()) return saved.value;

  const value = await scheduleMusicBrainzRequest(async () => {
    const response = await safeFetch(
      `${MB}/release?artist=${mbid}&inc=labels&limit=${PAGE}&fmt=json`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("Artist details are unavailable");
    const body = obj(await response.json());
    const labels = new Map<string, { id: string; name: string }>();
    const releases = new Set<string>();
    for (const release of rows(body.releases)) {
      const title = text(release.title);
      if (title.length > 2) releases.add(title);
      for (const info of rows(release["label-info"])) {
        const label = obj(info.label);
        const id = text(label.id);
        const name = text(label.name);
        if (uuid.test(id) && name.length > 2 && !labels.has(id)) labels.set(id, { id, name });
      }
    }
    return {
      labels: [...labels.values()].slice(0, MAX_LABELS),
      releases: [...releases].slice(0, MAX_RELEASES),
    };
  }, signal).catch(() => EMPTY);

  cache.set(mbid, { until: Date.now() + CACHE_MS, value });
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
  return value;
}
