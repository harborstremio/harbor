import { useEffect, useMemo, useState } from "react";
import { canonFor, canonInItems, canonPending, order, type CanonEntry } from "./canon";
import { loadListItems } from "./items";

const EMPTY: readonly CanonEntry[] = [];

/**
 * The big lists ship only a head in the index, so membership in Sight and Sound, the AFI
 * hundred or the National Film Registry can only be settled by reading the full snapshot.
 * What is already bundled shows immediately and the rest fills in behind it.
 */
export function useCanon(
  imdbId: string | null | undefined,
  kind: "movie" | "series",
): readonly CanonEntry[] {
  const immediate = useMemo(() => canonFor(imdbId, kind), [imdbId, kind]);
  const [deep, setDeep] = useState<readonly CanonEntry[]>(EMPTY);

  useEffect(() => {
    setDeep(EMPTY);
    if (!imdbId) return;
    const pending = canonPending(kind);
    if (pending.length === 0) return;
    let cancelled = false;
    void Promise.all(
      pending.map(async (list) =>
        canonInItems(list, await loadListItems(list.id).catch(() => []), imdbId),
      ),
    ).then((results) => {
      if (cancelled) return;
      setDeep(results.filter((entry): entry is CanonEntry => entry != null));
    });
    return () => {
      cancelled = true;
    };
  }, [imdbId, kind]);

  return useMemo(
    () => (deep.length === 0 ? immediate : order([...immediate, ...deep])),
    [immediate, deep],
  );
}
