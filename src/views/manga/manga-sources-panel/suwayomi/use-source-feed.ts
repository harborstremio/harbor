import { useCallback, useEffect, useRef, useState } from "react";
import {
  sourceLatest,
  sourcePopular,
  sourceSearch,
  type ServerConfig,
  type SuwayomiPage,
} from "@/lib/manga/sources/suwayomi/provider";
import type { MangaSummary } from "@/lib/manga/types";

export type FeedMode = "popular" | "latest";

export type SourceFeed = {
  items: MangaSummary[];
  state: "loading" | "ready" | "error";
  loadingMore: boolean;
  loadMoreFailed: boolean;
  hasNext: boolean;
  loadMore: () => void;
  retry: () => void;
};

function fetchPage(
  config: ServerConfig,
  sourceId: string,
  mode: FeedMode,
  query: string,
  page: number,
): Promise<SuwayomiPage> {
  const q = query.trim();
  if (q) return sourceSearch(config, sourceId, q, page);
  if (mode === "latest") return sourceLatest(config, sourceId, page);
  return sourcePopular(config, sourceId, page);
}

export function useSourceFeed(
  config: ServerConfig,
  sourceId: string,
  mode: FeedMode,
  query: string,
): SourceFeed {
  const [items, setItems] = useState<MangaSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [reload, setReload] = useState(0);
  const pageRef = useRef(1);
  const reqRef = useRef(0);

  useEffect(() => {
    const token = ++reqRef.current;
    pageRef.current = 1;
    setState("loading");
    setItems([]);
    setHasNext(false);
    setLoadMoreFailed(false);
    fetchPage(config, sourceId, mode, query, 1)
      .then((res) => {
        if (token !== reqRef.current) return;
        setItems(res.manga);
        setHasNext(res.hasNextPage);
        setState("ready");
      })
      .catch(() => {
        if (token === reqRef.current) setState("error");
      });
  }, [config.baseUrl, config.auth?.username, config.auth?.password, sourceId, mode, query, reload]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasNext) return;
    const token = reqRef.current;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    fetchPage(config, sourceId, mode, query, next)
      .then((res) => {
        if (token !== reqRef.current) return;
        pageRef.current = next;
        setItems((prev) => [...prev, ...res.manga]);
        setHasNext(res.hasNextPage);
      })
      .catch(() => {
        if (token === reqRef.current) setLoadMoreFailed(true);
      })
      .finally(() => {
        if (token === reqRef.current) setLoadingMore(false);
      });
  }, [config, sourceId, mode, query, hasNext, loadingMore]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  return { items, state, loadingMore, loadMoreFailed, hasNext, loadMore, retry };
}
