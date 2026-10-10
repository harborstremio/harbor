// Four different outcomes used to share one sentence. TMDB being down, a filter
// that outlived its results, nothing existing anywhere, and every source
// answering with something Big Picture has no route for are separate facts, and
// the screen has to say which one happened. The last of those is what made the
// owner file this: manga and the addon index counted toward hasResults while
// nothing on screen rendered them, so a search that had found plenty reported
// "Nothing Big Picture can play".
export function bpSearchEmptyMessage(params: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  trimmed: string;
  tmdbUnavailable: boolean;
  hasResults: boolean;
  noResults: boolean;
  filterStale: boolean;
  failedCount: number;
}): string {
  const { t, trimmed, tmdbUnavailable, hasResults, noResults, filterStale, failedCount } = params;
  if (!trimmed) return t("Start typing to search movies, series and everything your addons carry.");
  if (filterStale) return t("Nothing in this filter. Choose All to see everything that answered.");
  if (tmdbUnavailable) return t("TMDB is temporarily unavailable. Try your search again shortly.");
  if (failedCount > 0 && !hasResults)
    return t('Nothing found for "{q}". {n} of your addons did not answer.', { q: trimmed, n: failedCount });
  if (noResults) return t('Nothing found for "{q}"', { q: trimmed });
  if (hasResults)
    return t('Your addons answered for "{q}", but nothing in the results opens here.', { q: trimmed });
  return t('Nothing found for "{q}"', { q: trimmed });
}
