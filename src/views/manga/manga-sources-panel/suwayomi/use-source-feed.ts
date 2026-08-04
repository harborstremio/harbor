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

type FeedSnapshot = {
  key: string;
  items: MangaSummary[];
  state: "loading" | "ready" | "error";
  loadingMore: boolean;
  loadMoreFailed: boolean;
  hasNext: boolean;
};

function initialSnapshot(key: string): FeedSnapshot {
  return {
    key,
    items: [],
    state: "loading",
    loadingMore: false,
    loadMoreFailed: false,
    hasNext: false,
  };
}

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
  const [result, setResult] = useState<FeedSnapshot>(() => initialSnapshot(""));
  const [reload, setReload] = useState(0);
  const pageRef = useRef(1);
  const reqRef = useRef(0);
  const baseUrl = config.baseUrl;
  const username = config.auth?.username;
  const password = config.auth?.password;
  const requestKey = JSON.stringify([baseUrl, username, password, sourceId, mode, query, reload]);
  const snapshot = result.key === requestKey ? result : initialSnapshot(requestKey);

  useEffect(() => {
    const token = ++reqRef.current;
    pageRef.current = 1;
    const requestConfig: ServerConfig = {
      baseUrl,
      auth: username !== undefined && password !== undefined ? { username, password } : undefined,
    };
    fetchPage(requestConfig, sourceId, mode, query, 1)
      .then((res) => {
        if (token !== reqRef.current) return;
        setResult({
          key: requestKey,
          items: res.manga,
          state: "ready",
          loadingMore: false,
          loadMoreFailed: false,
          hasNext: res.hasNextPage,
        });
      })
      .catch(() => {
        if (token === reqRef.current) {
          setResult({ ...initialSnapshot(requestKey), state: "error" });
        }
      });
  }, [baseUrl, username, password, sourceId, mode, query, requestKey]);

  const loadMore = useCallback(() => {
    if (snapshot.loadingMore || !snapshot.hasNext) return;
    const token = reqRef.current;
    const next = pageRef.current + 1;
    setResult((previous) =>
      previous.key === requestKey
        ? { ...previous, loadingMore: true, loadMoreFailed: false }
        : previous,
    );
    const requestConfig: ServerConfig = {
      baseUrl,
      auth: username !== undefined && password !== undefined ? { username, password } : undefined,
    };
    fetchPage(requestConfig, sourceId, mode, query, next)
      .then((res) => {
        if (token !== reqRef.current) return;
        pageRef.current = next;
        setResult((previous) =>
          previous.key === requestKey
            ? {
                ...previous,
                items: [...previous.items, ...res.manga],
                hasNext: res.hasNextPage,
              }
            : previous,
        );
      })
      .catch(() => {
        if (token === reqRef.current) {
          setResult((previous) =>
            previous.key === requestKey ? { ...previous, loadMoreFailed: true } : previous,
          );
        }
      })
      .finally(() => {
        if (token === reqRef.current) {
          setResult((previous) =>
            previous.key === requestKey ? { ...previous, loadingMore: false } : previous,
          );
        }
      });
  }, [
    snapshot.loadingMore,
    snapshot.hasNext,
    requestKey,
    baseUrl,
    username,
    password,
    sourceId,
    mode,
    query,
  ]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  return {
    items: snapshot.items,
    state: snapshot.state,
    loadingMore: snapshot.loadingMore,
    loadMoreFailed: snapshot.loadMoreFailed,
    hasNext: snapshot.hasNext,
    loadMore,
    retry,
  };
}
