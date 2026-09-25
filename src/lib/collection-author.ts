/** Only persisted provenance or server-provided author metadata establishes authorship. */
export function collectionAuthorHandle(collection: {
  handle?: string;
  sourceHandle?: string;
  sourceId?: string;
}): string | null {
  const handle = (collection.sourceHandle ?? collection.handle ?? "").trim().toLowerCase();
  return /^[a-z\d_.-]+$/i.test(handle) ? handle : null;
}
