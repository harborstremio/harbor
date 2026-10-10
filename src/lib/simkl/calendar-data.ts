export type SimklCdnItem = {
  title: string;
  poster?: string | null;
  date: string;
  release_date?: string | null;
  ratings?: { simkl?: { rating?: number | null; votes?: number | null } };
  ids?: {
    simkl_id?: number;
    slug?: string;
    tmdb?: string | number;
    imdb?: string;
    mal?: string | number;
    kitsu?: string | number;
  };
  episode?: { season?: number; episode?: number };
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// V2 stores shared title metadata once and joins each airing by its Simkl ID.
export function parseSimklCalendar(data: unknown): SimklCdnItem[] {
  const payload = record(data);
  const metadata = record(payload?.metadata);
  if (!Array.isArray(payload?.calendar) || !metadata) return [];
  const items: SimklCdnItem[] = [];
  for (const value of payload.calendar) {
    const entry = record(value);
    const id = entry?.simkl_id;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) continue;
    const show = record(metadata[String(id)]);
    if (!show || typeof show.title !== "string" || !show.title.trim()) continue;
    if (typeof entry?.date !== "string" || !Number.isFinite(Date.parse(entry.date))) continue;
    items.push({
      ...(show as Omit<SimklCdnItem, "date">),
      ids: { ...record(show.ids), simkl_id: id },
      date: entry.date,
      episode: record(entry.episode) ?? undefined,
    });
  }
  return items;
}
