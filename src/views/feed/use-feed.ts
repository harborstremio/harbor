import { useCallback, useEffect, useState } from "react";
import {
  fetchFriendsFeed,
  fetchFriendsWatching,
  type FeedItem,
  type WatchingNow,
} from "@/lib/social/feed";

const WATCHING_POLL_MS = 60000;

export type FeedState = {
  items: FeedItem[];
  watching: WatchingNow[];
  friendCount: number;
  sharingCount: number;
  phase: "loading" | "ready" | "error";
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

export function useFeed(): FeedState {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [watching, setWatching] = useState<WatchingNow[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [sharingCount, setSharingCount] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    fetchFriendsFeed(undefined, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setItems(d.items);
        setCursor(d.nextCursor);
        setFriendCount(d.friendCount);
        setSharingCount(d.sharingCount);
        setPhase("ready");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setPhase("error");
      });
    return () => ctrl.abort();
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const pull = () => {
      fetchFriendsWatching(ctrl.signal)
        .then((d) => {
          if (!cancelled) setWatching(d.items);
        })
        .catch(() => {});
    };
    pull();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") pull();
    }, WATCHING_POLL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(timer);
    };
  }, [tick]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    fetchFriendsFeed(cursor)
      .then((d) => {
        setItems((p) => [...p, ...d.items]);
        setCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore]);

  return {
    items,
    watching,
    friendCount,
    sharingCount,
    phase,
    loadingMore,
    hasMore: !!cursor,
    loadMore,
    reload: useCallback(() => setTick((n) => n + 1), []),
  };
}
