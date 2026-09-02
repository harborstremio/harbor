import { useCallback, useState } from "react";

// Search deliberately keeps nothing here. Its filter is derived from the live
// query, because a chip persisted across queries collapses the next result set
// to one group with nothing on screen saying why.
type Store = {
  libraryTab: string;
  liveCategory: string;
  serviceCategory: string;
  collectionCategory: string;
  collectionSource: string;
};

const store: Store = {
  libraryTab: "saved",
  liveCategory: "all",
  serviceCategory: "all",
  collectionCategory: "All",
  collectionSource: "all",
};

export function resetBpViewState(): void {
  store.libraryTab = "saved";
  store.liveCategory = "all";
  store.serviceCategory = "all";
  store.collectionCategory = "All";
  store.collectionSource = "all";
}

export function useBpPersistedState<T extends string>(
  key: keyof Store,
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => (store[key] as T) || fallback);
  const set = useCallback(
    (next: T) => {
      store[key] = next;
      setValue(next);
    },
    [key],
  );
  return [value, set];
}
