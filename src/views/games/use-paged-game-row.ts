import { useEffect, useRef, useState } from "react";

export type GameRowPage<T> = { games: T[]; nextOffset: number | null; cachedAt?: number };
type RowState<T> = GameRowPage<T> & { key: string; loaded: boolean; busy: boolean; failed: boolean; failure?: "initial" | "more" };

/** Keep the current cards on screen while fetching the next provider page. */
export function usePagedGameRow<T extends { id: string }>({ id, active, load, snapshot, keyOf = (game: T) => game.id }: {
  id: string; active: boolean;
  load: (offset: number, signal: AbortSignal) => Promise<GameRowPage<T>>;
  snapshot?: () => Promise<GameRowPage<T> | null>;
  keyOf?: (game: T) => string;
}) {
  const loaders = useRef({ load, snapshot, keyOf }); loaders.current = { load, snapshot, keyOf };
  const cache = useRef(new Map<string, RowState<T>>());
  const [state, setState] = useState<RowState<T>>({ key: id, games: [], nextOffset: 0, loaded: false, busy: false, failed: false });
  const stateRef = useRef(state); stateRef.current = state;
  const request = useRef<AbortController | null>(null), [attempt, setAttempt] = useState(0);
  const publish = (value: RowState<T>) => { stateRef.current = value; cache.current.set(value.key, value); if (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value!); setState(value); };
  useEffect(() => {
    if (!active) return;
    const cached = cache.current.get(id);
    if (cached?.loaded && !cached.failed) { publish({ ...cached, busy: false }); return; }
    const controller = new AbortController(); request.current = controller;
    const empty: RowState<T> = { key: id, games: [], nextOffset: 0, loaded: false, busy: true, failed: false };
    publish({ ...(cached ?? empty), busy: true, failed: false });
    let received = false;
    void loaders.current.snapshot?.().then(page => { if (page && !received && !controller.signal.aborted) publish({ ...page, key: id, loaded: true, busy: true, failed: false }); }).catch(() => {});
    void loaders.current.load(0, controller.signal).then(page => {
      received = true; if (!controller.signal.aborted) publish({ ...page, key: id, loaded: true, busy: false, failed: false });
    }, () => { received = true; if (!controller.signal.aborted) publish({ ...stateRef.current, busy: false, failed: true, failure: "initial" }); });
    return () => controller.abort();
  }, [id, active, attempt]);
  useEffect(() => () => request.current?.abort(), [id, active]);
  const more = async (minimum: number) => {
    let previous = stateRef.current;
    if (!active || previous.key !== id || previous.busy || previous.nextOffset === null) return false;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    publish({ ...previous, busy: true, failed: false });
    try {
      // A provider page can contain overlaps or filtered entries. Continue a
      // bounded batch until the visible row fills, without inventing records.
      for (let batch = 0; batch < 3 && previous.nextOffset !== null; batch++) {
        const offset = previous.nextOffset;
        const next = await loaders.current.load(offset, controller.signal);
        if (controller.signal.aborted) return false;
        const seen = new Set(previous.games.map(loaders.current.keyOf));
        const additions = next.games.filter(game => { const key = loaders.current.keyOf(game); if (seen.has(key)) return false; seen.add(key); return true; });
        previous = { ...previous, ...next, games: [...previous.games, ...additions] };
        if (previous.nextOffset !== null && previous.nextOffset <= offset) throw new Error("Non-advancing game page");
        if (previous.games.length >= minimum) break;
      }
      publish({ ...previous, busy: false, failed: false }); return true;
    } catch { if (!controller.signal.aborted) publish({ ...stateRef.current, busy: false, failed: true, failure: "more" }); return false; }
  };
  const current = state.key === id ? state : { key: id, games: [], nextOffset: 0, loaded: false, busy: active, failed: false };
  const refresh = () => { cache.current.delete(id); setAttempt(value => value + 1); };
  return { ...current, more, refresh, retry: () => { if (current.failure === "more" && current.nextOffset !== null) void more(current.games.length + 1); else setAttempt(value => value + 1); } };
}

export function useRowNavigation<T extends { id: string }>(row: ReturnType<typeof usePagedGameRow<T>>, slots: number) {
  const [selection, setSelection] = useState({ key: row.key, page: 0, direction: 1 });
  const page = selection.key === row.key ? Math.min(selection.page, Math.max(0, Math.ceil(row.games.length / slots) - 1)) : 0;
  const hasNext = (page + 1) * slots < row.games.length || row.nextOffset !== null;
  const go = async (next: number) => {
    if (row.busy || next < 0) return;
    const start = next * slots;
    if ((next + 1) * slots > row.games.length && row.nextOffset !== null && next > page) {
      const done = await row.more((next + 1) * slots);
      if (!done) return;
    }
    if (start < row.games.length || row.nextOffset !== null) setSelection({ key: row.key, page: next, direction: next < page ? -1 : 1 });
  };
  return { page, direction: selection.direction, hasNext, go, visible: row.games.slice(page * slots, (page + 1) * slots) };
}
