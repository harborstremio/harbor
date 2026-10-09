export type EpisodeSpan = { season: number; episode: number; episodeEnd: number };

// Deliberately accepts only explicit, same-season TV notation. Bare numbers and
// cross-season ranges are not reliable enough to use for source selection.
const SPAN_PATTERNS = [
  /(?:^|[^a-z0-9])s(\d{1,3})[ ._-]*e(\d{1,4})[ ._-]*e(\d{1,4})(?!\d)/i,
  /(?:^|[^a-z0-9])s(\d{1,3})[ ._-]*e(\d{1,4})\s*-\s*e(\d{1,4})(?!\d)/i,
  /(?:^|[^a-z0-9])s(\d{1,3})[ ._-]*e(\d{1,4})\s*-\s*(\d{1,4})(?!\d)/i,
  /(?:^|[^a-z0-9])(\d{1,3})x(\d{1,4})\s*-\s*(\d{1,4})(?!\d)/i,
];

const SINGLE_PATTERNS = [
  /(?:^|[^a-z0-9])s(\d{1,3})[ ._-]*e(\d{1,4})(?!\d)/i,
  /(?:^|[^a-z0-9])(\d{1,3})x(\d{1,4})(?!\d)/i,
  /(?:^|[^a-z0-9])season[ ._-]*(\d{1,3})[ ._-]*(?:episode|ep)[ ._-]*(\d{1,4})(?!\d)/i,
];

export function parseEpisodeSpan(text: string): EpisodeSpan | null {
  if (/(?:^|[^a-z0-9])s\d{1,3}[ ._-]*e\d{1,4}\s*-\s*s\d{1,3}[ ._-]*e\d{1,4}(?!\d)/i.test(text))
    return null;
  for (const pattern of SPAN_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const season = Number(match[1]);
    const episode = Number(match[2]);
    const episodeEnd = Number(match[3]);
    if (season > 0 && episode > 0 && episodeEnd === episode + 1)
      return { season, episode, episodeEnd };
    return null;
  }
  for (const pattern of SINGLE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (season > 0 && episode > 0) return { season, episode, episodeEnd: episode };
  }
  return null;
}

export function episodeSpanContains(
  span: { season?: number | null; episode?: number | null; episodeEnd?: number | null },
  season: number,
  episode: number,
): boolean {
  return (
    span.season === season &&
    span.episode != null &&
    episode >= span.episode &&
    episode <= (span.episodeEnd ?? span.episode)
  );
}

export function episodeSpanLabel(span: {
  season: number;
  episode: number;
  episodeEnd?: number | null;
}): string {
  const start = String(span.episode).padStart(2, "0");
  const end = span.episodeEnd ?? span.episode;
  return `S${String(span.season).padStart(2, "0")}E${start}${end > span.episode ? `–E${String(end).padStart(2, "0")}` : ""}`;
}
