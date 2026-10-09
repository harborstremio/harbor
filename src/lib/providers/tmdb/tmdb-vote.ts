import { useEffect, useState } from "react";
import { get } from "./tmdb-client";
import { tmdbIdFromImdb } from "./tmdb-imdb-resolve";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function resolveVote(
  key: string,
  metaId: string,
  type: "movie" | "series",
): Promise<string | null> {
  if (cache.has(metaId)) return cache.get(metaId) ?? null;
  const pending = inflight.get(metaId);
  if (pending) return pending;
  const p = (async () => {
    const tmdbId = metaId.startsWith("tmdb:") ? metaId : await tmdbIdFromImdb(key, metaId, type);
    const match = tmdbId?.match(/^tmdb:(movie|tv):(\d+)$/);
    if (!match) {
      cache.set(metaId, null);
      return null;
    }
    const [, kind, id] = match;
    const data = await get<{ vote_average?: number; vote_count?: number }>(key, `${kind}/${id}`);
    if (!data) return null;
    const avg = data.vote_average;
    const out =
      typeof avg === "number" && avg > 0 && (data.vote_count ?? 0) > 0 ? avg.toFixed(1) : null;
    cache.set(metaId, out);
    return out;
  })().finally(() => {
    inflight.delete(metaId);
  });
  inflight.set(metaId, p);
  return p;
}

export function useTmdbVote(
  metaId: string | undefined,
  type: "movie" | "series",
  tmdbKey: string,
): string | null | undefined {
  const [v, setV] = useState<string | null | undefined>(() =>
    metaId && cache.has(metaId) ? cache.get(metaId) ?? null : undefined,
  );
  useEffect(() => {
    if (!metaId || !tmdbKey) {
      setV(undefined);
      return;
    }
    if (cache.has(metaId)) {
      setV(cache.get(metaId) ?? null);
      return;
    }
    setV(undefined);
    let on = true;
    resolveVote(tmdbKey, metaId, type)
      .then((r) => {
        if (on) setV(r);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [metaId, type, tmdbKey]);
  return v;
}
