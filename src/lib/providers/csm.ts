import { safeFetch } from "@/lib/safe-fetch";
import { generateCsmSlugs, parseCsmHtml, type CsmAdvisory } from "./csm-parser";

export { generateCsmSlugs, parseCsmHtml, type CsmAdvisory, type CsmCategory } from "./csm-parser";

const cache = new Map<string, CsmAdvisory | null>();
const inflight = new Map<string, Promise<CsmAdvisory | null>>();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Fetch a content advisory directly from Common Sense Media. */
export async function fetchCsmAdvisory(
  title: string,
  year?: string | number | null,
  isMovie = true,
): Promise<CsmAdvisory | null> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;

  const cacheKey = `${isMovie ? "movie" : "tv"}:${cleanTitle.toLowerCase()}:${year ?? ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const slugs = generateCsmSlugs(cleanTitle, year);
    const primaryPrefix = isMovie ? "movie-reviews" : "tv-reviews";
    const altPrefix = isMovie ? "tv-reviews" : "movie-reviews";

    for (const slug of slugs) {
      for (const prefix of [primaryPrefix, altPrefix]) {
        const url = `https://www.commonsensemedia.org/${prefix}/${slug}`;
        try {
          const res = await safeFetch(url, { headers: HEADERS });
          if (res.ok) {
            const advisory = parseCsmHtml(await res.text(), url);
            if (advisory) {
              cache.set(cacheKey, advisory);
              return advisory;
            }
          }
        } catch {
          /* A failed candidate must not prevent the remaining candidates from being tried. */
        }
      }
    }

    cache.set(cacheKey, null);
    return null;
  })().finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, promise);
  return promise;
}
