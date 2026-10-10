export type AthleteVideo = {
  id: string;
  title: string;
  image?: string;
  url: string;
  embed: string;
  duration?: string;
  published?: string;
  /** Provider expiration, retained so cached clips cannot outlive availability. */
  expiresAt?: number;
};
type Json = Record<string, any>;
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const safeImage = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /(?:^|\.)(?:espncdn\.com|espn\.com|akamaized\.net)$/.test(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};
export function parseAthleteVideos(raw: unknown, name: string, now = Date.now()): AthleteVideo[] {
  const needle = normalize(name);
  if (needle.length < 5) return [];
  const result = raw as Json;
  const groups = Array.isArray(result?.results) ? result.results : [];
  const seen = new Set<string>();
  return groups
    .filter((group: Json) => group && typeof group === "object" && group.type === "clips")
    .flatMap((group: Json) => (Array.isArray(group.contents) ? group.contents.slice(0, 30) : []))
    .flatMap((clip: Json) => {
      if (!clip || typeof clip !== "object") return [];
      const id = String(clip.id || "");
      const title = String(clip.displayName || "").slice(0, 300);
      // Search can return related athletes: only show a clip naming this person.
      if (!/^\d+$/.test(id) || seen.has(id) || !` ${normalize(title)} `.includes(` ${needle} `))
        return [];
      const expires = Date.parse(clip.timeRestrictions?.expirationDate || "");
      const embargo = Date.parse(clip.timeRestrictions?.embargoDate || "");
      if (
        (Number.isFinite(expires) && expires <= now) ||
        (Number.isFinite(embargo) && embargo > now)
      )
        return [];
      seen.add(id);
      return [
        {
          id,
          title,
          image: safeImage(clip.image?.default),
          url: `https://www.espn.com/video/clip/_/id/${id}`,
          embed: `https://www.espn.com/core/video/iframe?id=${id}&endcard=false`,
          duration:
            typeof clip.displayDuration === "string"
              ? clip.displayDuration.slice(0, 15)
              : undefined,
          published: typeof clip.date === "string" ? clip.date : undefined,
          expiresAt: Number.isFinite(expires) ? expires : undefined,
        },
      ];
    })
    .slice(0, 8);
}
const cache = new Map<string, { validUntil: number; videos: AthleteVideo[] }>();
export async function loadAthleteVideos(
  name: string,
  sport: string,
  signal: AbortSignal,
): Promise<AthleteVideo[]> {
  signal.throwIfAborted();
  const key = `${normalize(sport)}:${normalize(name)}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.validUntil) return hit.videos;
  const { safeFetch, allowDirectHost } = await import("@/lib/safe-fetch");
  const base = "https://site.web.api.espn.com";
  allowDirectHost(base);
  const response = await safeFetch(
    `${base}/apis/search/v2?query=${encodeURIComponent(`${name} ${sport}`)}&limit=20&type=clips`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
  );
  if (!response.ok) throw new Error("Videos unavailable");
  const data = await response.json();
  if (data?.errors) throw new Error("Videos unavailable");
  const videos = parseAthleteVideos(data, name);
  if (!signal.aborted) {
    const validUntil = Math.min(
      Date.now() + 3600_000,
      ...videos.map((video) => video.expiresAt ?? Infinity),
    );
    cache.set(key, { validUntil, videos });
    while (cache.size > 48) cache.delete(cache.keys().next().value!);
  }
  return videos;
}
export function athleteYoutubeSearch(name: string, league: string) {
  const channels: Record<string, string> = {
    UFC: "ufc",
    NBA: "NBA",
    WNBA: "WNBA",
    NFL: "NFL",
    NHL: "NHL",
    MLB: "MLB",
    NASCAR: "NASCAR",
    NXS: "NASCAR",
    NCTS: "NASCAR",
    F1: "Formula1",
    INDY: "indycar",
  };
  const channel = Object.hasOwn(channels, league) ? channels[league] : undefined;
  return channel
    ? `https://www.youtube.com/@${channel}/search?query=${encodeURIComponent(`${name} highlights`)}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} ${league} highlights`)}`;
}
