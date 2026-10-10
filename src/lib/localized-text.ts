import {
  isGenericEpisodeName,
  isTextInLanguage,
  isUsableLocalizedText,
} from "@/lib/providers/anime-episode-build";

/**
 * Rank how well a candidate localized text matches the user's selected language.
 *
 * Language-first principle: 2 beats 1 beats 0 regardless of which provider the
 * text came from. Provider identity never breaks ties — `pickLocalizedText`
 * knows nothing about providers by design; `score` is the only tie-break.
 *
 * @param text Candidate text (may be untrimmed; empty/whitespace ranks 0).
 * @param lang BCP-47-ish language tag (e.g. "ko", "pt-BR"); "" or "en" means English.
 * @returns
 * - 2 — text is in the target language (`isTextInLanguage`).
 * - 1 — usable fallback (Latin/English-ish, no foreign script): not rank 2 but
 *       passes the same fallback check `isUsableLocalizedText` uses.
 * - 0 — foreign-script mismatch (e.g. Japanese shown to a Korean user), or empty text.
 *
 * ACCEPTED DEGENERACY: for Latin-script target languages (es/fr/de/pt/it) there
 * is no script test, so `isTextInLanguage` returns true for English text as well
 * and rank 2 collapses into rank 1. For those languages, fetch provenance (which
 * candidate came from the target-language endpoint) is the primary signal in
 * consumers, not this rank. Conversely, for `lang` "en" or empty every usable
 * text ranks 2, so English users see no behavior change.
 */
export function rankLocalizedText(text: string, lang: string): 0 | 1 | 2 {
  if (isTextInLanguage(text, lang)) return 2;
  return isUsableLocalizedText(text, lang) ? 1 : 0;
}

/**
 * Pick the best localized text (title or overview) for the user's language from
 * any number of provider candidates. Language wins: the highest `rank` is picked
 * first; only candidates of equal rank are compared by `score`. English is never
 * preferred over a real match — it only survives as a global last resort when no
 * candidate matches the selected language at all.
 *
 * @param candidates Provider texts, optionally pre-ranked or pre-scored.
 * @param options
 * - `forName` — treat candidates as episode names: drop `isGenericEpisodeName`
 *   placeholders ("Episode 5" is not a translation and must never win over a real
 *   title) and default scores to `(generic ? -1 : 0) + Math.min(length, 60)`.
 * - `lang` — target language for ranking candidates that lack a provided `rank`.
 * @returns The winning text (trimmed), or `undefined` when no candidate remains;
 * callers then keep their existing fallback.
 *
 * Default score when `score` is not provided: for names
 * `(isGenericEpisodeName(name) ? -1 : 0) + Math.min(name.length, 60)`; for
 * overviews `Math.min(text.length, 200)` — longer preferred, which preserves the
 * current "longer wins" behavior for English users.
 */
export function pickLocalizedText(
  candidates: Array<{ text: string; rank?: 0 | 1 | 2; score?: number }>,
  options?: { forName?: boolean; lang?: string },
): string | undefined {
  const lang = options?.lang ?? "";
  const forName = options?.forName ?? false;
  let best: { text: string; rank: 0 | 1 | 2; score: number } | undefined;
  for (const candidate of candidates) {
    const text = candidate.text.trim();
    if (!text) continue;
    if (forName && isGenericEpisodeName(text)) continue;
    const rank = candidate.rank ?? rankLocalizedText(text, lang);
    const score =
      candidate.score ??
      (forName
        ? (isGenericEpisodeName(text) ? -1 : 0) + Math.min(text.length, 60)
        : Math.min(text.length, 200));
    if (best == null || rank > best.rank || (rank === best.rank && score > best.score)) {
      best = { text, rank, score };
    }
  }
  return best?.text;
}
