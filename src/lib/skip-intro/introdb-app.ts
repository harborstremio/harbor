import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { SkipKind, SkipSegment } from "./types";
import { warnProviderFailure } from "./provider-log";

type RawSeg = {
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
};

type RawResponse = {
  intro?: RawSeg | null;
  recap?: RawSeg | null;
  outro?: RawSeg | null;
};

const cache = new Map<string, SkipSegment[]>();
const inflight = new Map<string, Promise<SkipSegment[]>>();

function toSegment(raw: RawSeg | null | undefined, kind: SkipKind): SkipSegment | null {
  if (!raw) return null;
  const start = raw.start_ms;
  const end = raw.end_ms;
  if (typeof start !== "number" || typeof end !== "number" || end <= start) return null;
  return { kind, startSec: start / 1000, endSec: end / 1000, source: "introdb-app" };
}

export function fetchIntroDbAppSegments(
  imdbId: string,
  episode: { season: number; episode: number },
): Promise<SkipSegment[]> {
  const params = new URLSearchParams();
  params.set("imdb_id", imdbId);
  params.set("season", String(episode.season));
  params.set("episode", String(episode.episode));
  const key = params.toString();
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(`https://api.introdb.app/segments?${key}`);
    if (!res.ok) {
      if (res.status === 404) cache.set(key, []);
      else warnProviderFailure("introdb-app", res.status, key);
      return [];
    }
    const json = (await res.json()) as RawResponse;
    const out: SkipSegment[] = [];
    const add = (raw: RawSeg | null | undefined, kind: SkipKind) => {
      const seg = toSegment(raw, kind);
      if (seg) out.push(seg);
    };
    add(json.intro, "intro");
    add(json.recap, "recap");
    add(json.outro, "outro");
    out.sort((a, b) => a.startSec - b.startSec);
    cache.set(key, out);
    return out;
  })()
    .catch((): SkipSegment[] => [])
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}
