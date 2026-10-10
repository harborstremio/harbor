import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { SkipKind, SkipSegment } from "./types";
import { warnProviderFailure } from "./provider-log";

type RawSeg = {
  start_ms?: number | null;
  end_ms?: number | null;
  match?: string;
  confidence?: number;
};

type RawResponse = {
  segments?: {
    intro?: RawSeg | null;
    recap?: RawSeg | null;
    outro?: RawSeg | null;
    preview?: RawSeg | null;
  };
};

const cache = new Map<string, SkipSegment[]>();
const inflight = new Map<string, Promise<SkipSegment[]>>();

const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
let coolingUntil = 0;

function toSegment(raw: RawSeg | null | undefined, kind: SkipKind): SkipSegment | null {
  if (!raw) return null;
  if (raw.match === "out-of-range") return null;
  if (typeof raw.confidence === "number" && raw.confidence < 0.35) return null;
  const start = raw.start_ms;
  const end = raw.end_ms;
  if (typeof start !== "number" || typeof end !== "number" || end <= start) return null;
  return { kind, startSec: start / 1000, endSec: end / 1000, source: "skipdb" };
}

export function fetchSkipDbSegments(
  imdbId: string,
  episode: { season: number; episode: number } | undefined,
  durationSec: number,
): Promise<SkipSegment[]> {
  const params = new URLSearchParams();
  params.set("imdb_id", imdbId);
  if (episode) {
    params.set("season", String(episode.season));
    params.set("episode", String(episode.episode));
  }
  if (durationSec > 0) params.set("duration", String(Math.round(durationSec)));
  const key = params.toString();
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  if (Date.now() < coolingUntil) return Promise.resolve([]);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(`https://api.skipdb.tv/api/segments?${key}`);
    if (!res.ok) {
      if (res.status === 404) {
        cache.set(key, []);
      } else {
        coolingUntil = Date.now() + FAILURE_COOLDOWN_MS;
        warnProviderFailure("skipdb", res.status, key);
      }
      return [];
    }
    const json = (await res.json()) as RawResponse;
    const s = json.segments;
    const out: SkipSegment[] = [];
    const add = (raw: RawSeg | null | undefined, kind: SkipKind) => {
      const seg = toSegment(raw, kind);
      if (seg) out.push(seg);
    };
    add(s?.intro, "intro");
    add(s?.recap, "recap");
    add(s?.outro, "outro");
    add(s?.preview, "outro");
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
