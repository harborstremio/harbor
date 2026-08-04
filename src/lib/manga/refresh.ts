type MangaQueryClient = {
  cancelQueries(filters: { queryKey: readonly unknown[] }): Promise<unknown>;
  invalidateQueries(filters: { queryKey: readonly unknown[] }): Promise<unknown>;
};

const listeners = new Set<() => void>();
const MANGA_QUERY_KEY = ["harbor", "manga"] as const;
let pendingChange = false;

export async function refreshMangaData(
  queryClient: MangaQueryClient,
  clearCaches: () => void,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: MANGA_QUERY_KEY });
  clearCaches();
  await queryClient.invalidateQueries({ queryKey: MANGA_QUERY_KEY });
}

export function notifyMangaDataChanged(): void {
  pendingChange = true;
  for (const listener of listeners) listener();
}

export function consumeMangaDataChange(): boolean {
  const changed = pendingChange;
  pendingChange = false;
  return changed;
}

export function subscribeMangaDataChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
