import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMUNITY_COLLECTION_PAGE_SIZE, COMMUNITY_COLLECTIONS_EVENT,
  fetchCommunityCollectionsPage, type CommunityCollection,
} from "@/lib/social/collections-sync";

type Feed = { items: CommunityCollection[]; visible: number; cursor: string | null; loaded: boolean; loading: boolean; failed: boolean };
const initial: Feed = { items: [], visible: 0, cursor: null, loaded: false, loading: false, failed: false };

export function useCommunityCollections(active: boolean) {
  const [state, setState] = useState<Feed>(initial);
  const current = useRef(state); current.current = state;
  const enabled = useRef(active); enabled.current = active;
  const request = useRef<AbortController | null>(null);
  const dirty = useRef(false), failedRefresh = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!enabled.current || (!reset && request.current)) return;
    const previous = current.current;
    if (!reset && previous.visible < previous.items.length) {
      setState(old => ({ ...old, visible: Math.min(old.items.length, old.visible + COMMUNITY_COLLECTION_PAGE_SIZE) }));
      return;
    }
    if (!reset && previous.loaded && !previous.cursor) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState(old => ({ ...old, loading: true, failed: false }));
    try {
      const page = await fetchCommunityCollectionsPage(reset ? null : previous.cursor, controller.signal);
      if (controller.signal.aborted) return;
      setState(old => {
        const merged = new Map<string, CommunityCollection>();
        for (const item of [...(reset ? [] : old.items), ...page.collections]) merged.set(`${item.handle.toLowerCase()}/${item.id}`, item);
        const items = [...merged.values()];
        return { items, visible: Math.min(items.length, reset ? COMMUNITY_COLLECTION_PAGE_SIZE : old.visible + COMMUNITY_COLLECTION_PAGE_SIZE), cursor: page.nextCursor, loaded: true, loading: false, failed: false };
      });
      failedRefresh.current = false;
    } catch {
      if (!controller.signal.aborted) {
        failedRefresh.current = reset;
        setState(old => ({ ...old, loading: false, failed: true }));
      }
    } finally { if (request.current === controller) request.current = null; }
  }, []);

  useEffect(() => {
    if (active) {
      if (!current.current.loaded || dirty.current) { dirty.current = false; void load(true); }
    } else {
      request.current?.abort(); request.current = null;
      setState(old => old.loading ? { ...old, loading: false } : old);
    }
    return () => { request.current?.abort(); request.current = null; };
  }, [active, load]);

  useEffect(() => {
    const changed = () => { if (enabled.current) void load(true); else dirty.current = true; };
    window.addEventListener(COMMUNITY_COLLECTIONS_EVENT, changed);
    return () => window.removeEventListener(COMMUNITY_COLLECTIONS_EVENT, changed);
  }, [load]);

  return {
    collections: state.items.slice(0, state.visible),
    loading: state.loading, failed: state.failed, loaded: state.loaded,
    hasMore: state.visible < state.items.length || state.cursor !== null,
    loadMore: useCallback(() => load(false), [load]),
    refresh: useCallback(() => load(true), [load]),
    retry: useCallback(() => load(failedRefresh.current || !current.current.loaded), [load]),
  };
}
