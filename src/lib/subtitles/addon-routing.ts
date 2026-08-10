export type SubtitleIdQuery = {
  imdbId?: string;
  stremioId?: string;
  season?: number;
  episode?: number;
};

export function subtitleContentIds(query: SubtitleIdQuery): string[] {
  const rawImdb = query.imdbId?.trim();
  const imdbId = rawImdb ? (rawImdb.startsWith("tt") ? rawImdb : `tt${rawImdb}`) : "";
  const candidates = [imdbId, query.stremioId?.trim() ?? ""].filter(Boolean);
  const isEpisode = query.season != null && query.episode != null;
  return [...new Set(candidates)].map((base) =>
    isEpisode && !/:\d+:\d+$/.test(base) ? `${base}:${query.season}:${query.episode}` : base,
  );
}

export function routeSubtitleAddonIds<T>(
  addons: T[],
  query: SubtitleIdQuery,
  accepts: (addon: T, id: string) => boolean,
): { ids: string[]; matches: Array<{ addon: T; id: string }> } {
  const ids = subtitleContentIds(query);
  const matches: Array<{ addon: T; id: string }> = [];
  for (const addon of addons) {
    const id = ids.find((candidate) => accepts(addon, candidate));
    if (id) matches.push({ addon, id });
  }
  return { ids, matches };
}
