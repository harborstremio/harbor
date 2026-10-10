import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbSearchTitle } from "@/lib/providers/tmdb/tmdb-catalogs";
import { tmdbDetails, type CastEntry } from "@/lib/providers/tmdb/tmdb-details";

export type ProgramMeta = {
  meta: Meta;
  cast: CastEntry[];
  directors: string[];
};

const LIVE_PREFIX = /^(live|new|encore|repeat|premiere|season premiere|series premiere)\s*[:\-–]\s*/i;
const TRAILING_PART = /\s*[,(-]\s*(part|pt\.?|ep\.?|episode)\s*\d+\s*\)?$/i;
const BRACKETED = /\s*[[(]\s*(hd|sd|4k|uhd|cc|new|live|repeat|r|s\d+\s*e\d+)\s*[\])]\s*/gi;
const YEAR = /\s*[([]?((?:19|20)\d{2})[)\]]?\s*$/;

const HOPELESS = [
  /^(news|sports?|weather|paid programming|to be announced|tba|tbd|no information|off air|closed)$/i,
  /\b(news ?(at|tonight|hour|desk|now)|newsroom|headlines|sportscenter|top stories)\b/i,
  /^us\|/i,
  /^\d+$/,
];

export function normalizeProgramTitle(raw: string): { query: string; year?: number } {
  let s = (raw || "").trim();
  s = s.replace(BRACKETED, " ");
  s = s.replace(LIVE_PREFIX, "");
  s = s.replace(TRAILING_PART, "");
  let year: number | undefined;
  const m = s.match(YEAR);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1900 && n <= new Date().getFullYear() + 2) {
      year = n;
      s = s.slice(0, m.index).trim();
    }
  }
  return { query: s.replace(/\s{2,}/g, " ").trim(), year };
}

function worthLooking(query: string): boolean {
  if (query.length < 3 || query.length > 90) return false;
  if (!/[a-z]/i.test(query)) return false;
  return !HOPELESS.some((re) => re.test(query));
}

const cache = new Map<string, ProgramMeta | null>();
const inflight = new Map<string, Promise<ProgramMeta | null>>();

async function resolve(key: string, title: string): Promise<ProgramMeta | null> {
  const { query, year } = normalizeProgramTitle(title);
  if (!worthLooking(query)) return null;

  const found =
    (await tmdbSearchTitle(key, "series", query, year).catch(() => null)) ??
    (await tmdbSearchTitle(key, "movie", query, year).catch(() => null));
  if (!found) return null;

  const detail = await tmdbDetails(key, found).catch(() => null);
  const cast = (detail?.cast ?? []).slice().sort((a, b) => a.order - b.order).slice(0, 6);
  const directors = (detail?.crew ?? [])
    .filter((c) => c.job === "Director" || c.department === "Directing")
    .slice(0, 2)
    .map((c) => c.name);

  return { meta: found, cast, directors };
}

export function programMetaCached(title: string): ProgramMeta | null | undefined {
  return cache.get(title.trim().toLowerCase());
}

export function useProgramMeta(title: string, apiKey: string | null | undefined, enabled: boolean) {
  const cacheKey = title.trim().toLowerCase();
  const [value, setValue] = useState<ProgramMeta | null | undefined>(() => cache.get(cacheKey));

  useEffect(() => {
    if (!enabled || !apiKey || !cacheKey) return;
    if (cache.has(cacheKey)) {
      setValue(cache.get(cacheKey));
      return;
    }
    let alive = true;
    let job = inflight.get(cacheKey);
    if (!job) {
      job = resolve(apiKey, title)
        .catch(() => null)
        .then((r) => {
          cache.set(cacheKey, r);
          inflight.delete(cacheKey);
          return r;
        });
      inflight.set(cacheKey, job);
    }
    void job.then((r) => {
      if (alive) setValue(r);
    });
    return () => {
      alive = false;
    };
  }, [cacheKey, apiKey, enabled, title]);

  return { data: value ?? null, loading: enabled && !!apiKey && value === undefined };
}
