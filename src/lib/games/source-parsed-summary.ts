import type { SourceRelease, SourceRecentPreview } from './sources';
import type { SourceEntryLayout } from './source-store-format';

export type ParsedSourceSummary = {
  layout: SourceEntryLayout;
  recent: SourceRecentPreview[];
  recentAt: number;
  recentUntil: number;
};
const summaries = new WeakMap<SourceRelease[], ParsedSourceSummary>();
export const parsedSourceSummary = (entries: SourceRelease[]) => summaries.get(entries);

/** Freeze each acknowledged batch, so editing a parsed release requires a new snapshot. */
export function freezeParsedEntries(entries: SourceRelease[]) {
  for (const entry of entries) {
    for (const file of entry.files) Object.freeze(file);
    Object.freeze(entry.files); Object.freeze(entry);
  }
  Object.freeze(entries);
}

export function rememberParsedSummary(entries: SourceRelease[], summary: ParsedSourceSummary) {
  if (!Object.isFrozen(entries) || (summary.layout.ends.at(-1) ?? 0) !== entries.length) throw Error('source_processing');
  for (const entry of summary.recent) Object.freeze(entry);
  Object.freeze(summary.recent);
  Object.freeze(summary.layout.ends); Object.freeze(summary.layout); Object.freeze(summary);
  summaries.set(entries, summary);
}
