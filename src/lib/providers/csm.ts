import { safeFetch } from "@/lib/safe-fetch";

export type CsmCategory = {
  category: string;
  severity: "None" | "Mild" | "Moderate" | "Severe";
};

export type CsmAdvisory = {
  categories: CsmCategory[];
  ageRating: string | null;
  mpaaRating: string | null;
  badgeRating: string | null;
  overallScore?: number | null;
  sourceUrl?: string;
};

const cache = new Map<string, CsmAdvisory | null>();
const inflight = new Map<string, Promise<CsmAdvisory | null>>();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Generate candidate CSM URL slugs for a title.
 */
export function generateCsmSlugs(title: string, year?: string | number | null): string[] {
  if (!title) return [];
  const slugs: string[] = [];

  const cleanYear = year ? String(year).trim().slice(0, 4) : null;

  // Basic ascii normalization
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’:]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base) {
    slugs.push(base);

    if (base.includes("and")) {
      const withoutAnd = base
        .replace(/and/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (withoutAnd && withoutAnd !== base) slugs.push(withoutAnd);
    }

    if (cleanYear) {
      slugs.push(`${base}-${cleanYear}`);
      slugs.push(`${base}-${cleanYear}-movie`);
      slugs.push(`${base}-movie`);
      slugs.push(`${base}-tv`);
    }

    if (base.startsWith("the-")) {
      const withoutThe = base.replace(/^the-/, "");
      slugs.push(withoutThe);
      if (cleanYear) {
        slugs.push(`${withoutThe}-${cleanYear}`);
      }
    }

    // Split subtitle by colon or dash with spaces
    if (title.includes(":") || title.includes(" - ")) {
      const mainPart = title.split(/:|\s+-\s+/)[0].trim();
      const mainBase = mainPart
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’:]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (mainBase && mainBase !== base) {
        slugs.push(mainBase);
        if (cleanYear) {
          slugs.push(`${mainBase}-${cleanYear}`);
        }
      }
    }
  }

  return [...new Set(slugs)];
}

function scoreToSeverity(
  score: number | null | undefined,
): "None" | "Mild" | "Moderate" | "Severe" {
  if (score == null || score <= 0) return "None";
  if (score <= 2) return "Mild";
  if (score === 3) return "Moderate";
  return "Severe";
}

/**
 * Robust 3-tier parser for Common Sense Media review HTML.
 */
export function parseCsmHtml(html: string, sourceUrl?: string): CsmAdvisory | null {
  if (!html || html.length < 50) return null;

  let age: number | null = null;
  let mpaa: string | null = null;
  let rawViolence: number | null = null;
  let rawSex: number | null = null;
  let rawLanguage: number | null = null;
  let rawDrugs: number | null = null;
  let overallScore: number | null = null;

  // 1. Tier 1: Drupal amplitude_props JSON embedded in page
  const ampMatch =
    html.match(/"amplitude_props":\s*({[\s\S]*?"csm_user_member_type":"[^"]*"})/i) ||
    html.match(/"amplitude_props":\s*({[\s\S]*?"csm_content_type":"[^"]*"[\s\S]*?})/i) ||
    html.match(/"amplitude_props":\s*({[\s\S]*?})/i);

  if (ampMatch) {
    try {
      const obj = JSON.parse(ampMatch[1]);
      if (obj.csm_review_rating_age != null) age = Number(obj.csm_review_rating_age);
      if (obj.csm_review_rating_overall != null)
        overallScore = Number(obj.csm_review_rating_overall);

      if (obj.csm_title_industry_rating_mpaa) {
        mpaa = String(obj.csm_title_industry_rating_mpaa);
      } else if (obj.csm_title_industry_rating_tv) {
        mpaa = String(obj.csm_title_industry_rating_tv);
      }

      if (obj.csm_review_rating_details_violence != null) {
        rawViolence = Number(obj.csm_review_rating_details_violence);
      }
      if (obj.csm_review_rating_details_sex != null) {
        rawSex = Number(obj.csm_review_rating_details_sex);
      }
      if (obj.csm_review_rating_details_language != null) {
        rawLanguage = Number(obj.csm_review_rating_details_language);
      }
      if (obj.csm_review_rating_details_drugs != null) {
        rawDrugs = Number(obj.csm_review_rating_details_drugs);
      }
    } catch {
      /* parse error — fall through to next tier */
    }
  }

  // 2. Tier 2: Google Analytics ga_dimension variables
  if (rawViolence == null || age == null) {
    const gaMatch = html.match(/"csm_content_grid":\s*"([^"]+)"/i);
    if (gaMatch) {
      const parts = gaMatch[1].split(",");
      for (const p of parts) {
        const [k, v] = p.split(":").map((s) => s.trim());
        const n = Number(v);
        if (Number.isFinite(n)) {
          if (k.startsWith("violen") && rawViolence == null) rawViolence = n;
          if (k.startsWith("sex") && rawSex == null) rawSex = n;
          if (k.startsWith("langua") && rawLanguage == null) rawLanguage = n;
          if (k.startsWith("drugs") && rawDrugs == null) rawDrugs = n;
        }
      }
    }
    if (age == null) {
      const ageGa = html.match(/"csm_age_rating":\s*"(\d+)"/i);
      if (ageGa) age = Number(ageGa[1]);
    }
    if (!mpaa) {
      const mpaaGa = html.match(/"csm_outside_rating":\s*"([^"]+)"/i);
      if (mpaaGa && mpaaGa[1] !== "NR") mpaa = mpaaGa[1];
    }
  }

  // 3. Tier 3: DOM regex patterns
  if (age == null) {
    const ageHtml = html.match(/class=["']rating__age["'][^>]*>\s*age\s*(\d+\+?)/i);
    if (ageHtml) age = Number(ageHtml[1].replace("+", ""));
  }

  const categories: CsmCategory[] = [
    { category: "Violence & Gore", severity: scoreToSeverity(rawViolence) },
    { category: "Sex & Nudity", severity: scoreToSeverity(rawSex) },
    { category: "Profanity", severity: scoreToSeverity(rawLanguage) },
    { category: "Alcohol, Drugs & Smoking", severity: scoreToSeverity(rawDrugs) },
  ];

  const ageRating = age != null && age > 0 ? `${age}+` : null;
  const badgeRating = ageRating || (mpaa && mpaa !== "NR" ? mpaa : null);

  if (categories.length === 0 && !badgeRating) return null;

  return {
    categories,
    ageRating,
    mpaaRating: mpaa && mpaa !== "NR" ? mpaa : null,
    badgeRating,
    overallScore,
    sourceUrl,
  };
}

/**
 * Fetch CSM content advisory directly from commonsensemedia.org.
 */
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
            const html = await res.text();
            const advisory = parseCsmHtml(html, url);
            if (advisory && (advisory.categories.length > 0 || advisory.badgeRating)) {
              cache.set(cacheKey, advisory);
              return advisory;
            }
          }
        } catch {
          /* network failure on single slug candidate — continue trying next */
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
