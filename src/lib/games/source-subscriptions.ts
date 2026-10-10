import { sourceUrl, type GameSource, type SourceManifest } from "./sources";

export function sameSourceRevision(current: GameSource, reviewed: GameSource) {
  const a = current.catalogIssue, b = reviewed.catalogIssue;
  // A settings write rereads unavailable catalogs into fresh guarded arrays.
  // Their immutable disk version still identifies the same reviewed payload.
  const sameCatalog = current.entries === reviewed.entries || !!a && !!b && a.profile === b.profile && a.version === b.version && a.parts === b.parts;
  return current.id === reviewed.id && current.url === reviewed.url && current.checkedAt === reviewed.checkedAt && sameCatalog;
}

/** Replace only the reviewed catalog; retain the subscription's current on/off choice. */
export function replaceGameSource(sources: GameSource[], reviewed: GameSource, input: string, manifest: SourceManifest, checkedAt = Date.now()) {
  const url = sourceUrl(input);
  if (!url) throw Error("source_url");
  const current = sources.find(source => source.id === reviewed.id);
  if (!current || !sameSourceRevision(current, reviewed)) throw Error("source_changed");
  if (sources.some(source => source.id !== current.id && source.url === url)) throw Error("source_duplicate");
  // Construct from the new manifest so an old website adapter or error cannot survive.
  const replacement: GameSource = { ...manifest, id: current.id, enabled: current.enabled, url, checkedAt };
  return sources.map(source => source.id === current.id ? replacement : source);
}
