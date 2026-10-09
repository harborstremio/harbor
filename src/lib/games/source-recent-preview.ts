import type { SourceRecentPreview } from './sources';

/** Whitelist scalar fields so summaries cannot retain file mirrors or source back-references. */
export function sourceRecentPreview(release: Omit<SourceRecentPreview, 'row'>, row: number): SourceRecentPreview {
  return { row, id: release.id, title: release.title, steamId: release.steamId, igdbId: release.igdbId,
    platform: release.platform, date: release.date, kind: release.kind };
}

export function validateRecentPreviews(value: unknown, count: number, now: number, limit: number): SourceRecentPreview[] {
  if (!Array.isArray(value) || value.length > Math.min(count, limit)) throw Error('source_cache');
  const rows = new Set<number>(), ids = new Set<string>();
  const text = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  return value.map(item => {
    if (!item || !Number.isSafeInteger(item.row) || item.row < 0 || item.row >= count || rows.has(item.row)
      || !text(item.id, 200) || ids.has(item.id) || !text(item.title, 500) || item.kind !== 'game'
      || !text(item.date, 40) || !Number.isFinite(Date.parse(item.date)) || Date.parse(item.date) <= 0 || Date.parse(item.date) > now
      || item.platform !== undefined && !text(item.platform, 100)) throw Error('source_cache');
    for (const id of [item.steamId, item.igdbId]) if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) throw Error('source_cache');
    rows.add(item.row); ids.add(item.id);
    return sourceRecentPreview(item, item.row);
  });
}
