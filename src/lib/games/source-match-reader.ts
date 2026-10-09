import { iterateCatalogRows } from './source-store-db';
import type { StoredCatalog } from './source-store-format';
import { matchingReleases, parseStoredSourceManifest, type SourceRelease } from './sources';
import { sourceMatchMetadata, sourceMatchSignature, type StoredMatchPreview } from './source-match-preview';
import { uniqueSourceFiles } from './source-files';

function validateEntry(catalog: StoredCatalog, entry: SourceRelease): SourceRelease {
  const parsed = parseStoredSourceManifest({ ...catalog.source, entries: [entry] });
  if (parsed.skipped || parsed.entries.length !== 1) throw Error('source_storage');
  return parsed.entries[0];
}

export async function readMatchPreviews(profile: string, catalog: StoredCatalog, rows: number[], ends: number[], game: Parameters<typeof matchingReleases>[1]): Promise<StoredMatchPreview[]> {
  const result: StoredMatchPreview[] = [];
  for await (const { row, entry } of iterateCatalogRows(profile, catalog, rows, ends)) {
    const release = validateEntry(catalog, entry);
    // Candidate hashes are only an index. Preserve exact identity, title,
    // platform and origin validation before showing a release.
    const matched = matchingReleases([{ ...catalog.source, enabled: true, entries: [release] }], game)[0];
    if (matched) result.push({ release: sourceMatchMetadata(release), match: matched.match,
      deferred: { signature: await sourceMatchSignature(release), rows: [row] } });
  }
  return result;
}

export async function readMatchFiles(profile: string, catalog: StoredCatalog, previews: StoredMatchPreview[], ends: number[]): Promise<SourceRelease[]> {
  const rows = previews.flatMap(item => item.deferred.rows);
  if (previews.some(item => !item.deferred.rows.length || !/^[a-f0-9]{64}$/.test(item.deferred.signature))) throw Error('source_storage');
  const result: SourceRelease[] = [];
  let selected = 0, offset = 0;
  // Duplicate rows retain match/date priority, including tracker merge order.
  for await (const { entry } of iterateCatalogRows(profile, catalog, rows, ends)) {
    const release = validateEntry(catalog, entry), expected = previews[selected];
    if (await sourceMatchSignature(release) !== expected.deferred.signature) throw Error('source_storage');
    if (!offset) {
      if (JSON.stringify(sourceMatchMetadata(release)) !== JSON.stringify(expected.release)) throw Error('source_storage');
      result.push(release);
    } else {
      const kept = result[selected];
      result[selected] = { ...kept, files: uniqueSourceFiles([...kept.files, ...release.files]) };
    }
    if (++offset === expected.deferred.rows.length) { selected++; offset = 0; }
  }
  return result;
}
