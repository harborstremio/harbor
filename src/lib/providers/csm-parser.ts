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

/** Generate candidate Common Sense Media URL slugs for a title. */
export function generateCsmSlugs(title: string, year?: string | number | null): string[] {
  if (!title) return [];
  const slugs: string[] = [];
  const cleanYear = year ? String(year).trim().slice(0, 4) : null;
  const base = normalizeSlug(title);

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
      if (cleanYear) slugs.push(`${withoutThe}-${cleanYear}`);
    }

    if (title.includes(":") || title.includes(" - ")) {
      const mainBase = normalizeSlug(title.split(/:|\s+-\s+/)[0].trim());
      if (mainBase && mainBase !== base) {
        slugs.push(mainBase);
        if (cleanYear) slugs.push(`${mainBase}-${cleanYear}`);
      }
    }
  }

  return [...new Set(slugs)];
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’:]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scoreToSeverity(
  score: number | null | undefined,
): "None" | "Mild" | "Moderate" | "Severe" {
  if (score == null || score <= 0) return "None";
  if (score <= 2) return "Mild";
  if (score === 3) return "Moderate";
  return "Severe";
}

/** Parse the advisory fields embedded in a Common Sense Media review page. */
export function parseCsmHtml(html: string, sourceUrl?: string): CsmAdvisory | null {
  if (!html || html.length < 50) return null;

  let age: number | null = null;
  let mpaa: string | null = null;
  let rawViolence: number | null = null;
  let rawSex: number | null = null;
  let rawLanguage: number | null = null;
  let rawDrugs: number | null = null;
  let overallScore: number | null = null;

  const ampMatch =
    html.match(/"amplitude_props":\s*({[\s\S]*?"csm_user_member_type":"[^"]*"})/i) ||
    html.match(/"amplitude_props":\s*({[\s\S]*?"csm_content_type":"[^"]*"[\s\S]*?})/i) ||
    html.match(/"amplitude_props":\s*({[\s\S]*?})/i);

  if (ampMatch) {
    try {
      const obj = JSON.parse(ampMatch[1]);
      if (obj.csm_review_rating_age != null) age = Number(obj.csm_review_rating_age);
      if (obj.csm_review_rating_overall != null) {
        overallScore = Number(obj.csm_review_rating_overall);
      }
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
      /* Invalid embedded JSON can still fall through to the other page formats. */
    }
  }

  if (rawViolence == null || age == null) {
    const gaMatch = html.match(/"csm_content_grid":\s*"([^"]+)"/i);
    if (gaMatch) {
      for (const part of gaMatch[1].split(",")) {
        const [key, value] = part.split(":").map((item) => item.trim());
        const score = Number(value);
        if (!Number.isFinite(score)) continue;
        if (key.startsWith("violen") && rawViolence == null) rawViolence = score;
        if (key.startsWith("sex") && rawSex == null) rawSex = score;
        if (key.startsWith("langua") && rawLanguage == null) rawLanguage = score;
        if (key.startsWith("drugs") && rawDrugs == null) rawDrugs = score;
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

  if (age == null) {
    const ageHtml = html.match(/class=["']rating__age["'][^>]*>\s*age\s*(\d+\+?)/i);
    if (ageHtml) age = Number(ageHtml[1].replace("+", ""));
  }

  const hasCategoryEvidence = [rawViolence, rawSex, rawLanguage, rawDrugs].some(
    (score) => score != null,
  );
  const ageRating = age != null && age > 0 ? `${age}+` : null;
  const badgeRating = ageRating || (mpaa && mpaa !== "NR" ? mpaa : null);
  if (!hasCategoryEvidence && !badgeRating) return null;

  return {
    categories: [
      { category: "Violence & Gore", severity: scoreToSeverity(rawViolence) },
      { category: "Sex & Nudity", severity: scoreToSeverity(rawSex) },
      { category: "Profanity", severity: scoreToSeverity(rawLanguage) },
      { category: "Alcohol, Drugs & Smoking", severity: scoreToSeverity(rawDrugs) },
    ],
    ageRating,
    mpaaRating: mpaa && mpaa !== "NR" ? mpaa : null,
    badgeRating,
    overallScore,
    sourceUrl,
  };
}
