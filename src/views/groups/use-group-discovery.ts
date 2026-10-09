import { useCallback, useEffect, useState } from "react";
import { fetchMyGroups, fetchPublicGroups, type Group } from "@/lib/social/groups";

export type DiscoveryState = {
  q: string;
  setQ: (v: string) => void;
  tag: string | null;
  setTag: (v: string | null) => void;
  mine: Group[];
  groups: Group[];
  topTags: string[];
  total: number;
  phase: "loading" | "ready" | "error";
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

export function useGroupDiscovery(signedIn: boolean): DiscoveryState {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [mine, setMine] = useState<Group[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [topTags, setTopTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setMine([]);
      return;
    }
    const ctrl = new AbortController();
    fetchMyGroups(ctrl.signal)
      .then((list) => {
        if (!ctrl.signal.aborted) setMine(list);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [signedIn, tick]);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    const timer = window.setTimeout(() => {
      fetchPublicGroups({ q: q.trim() || undefined, tag: tag || undefined }, ctrl.signal)
        .then((d) => {
          if (ctrl.signal.aborted) return;
          setGroups(d.groups);
          setTopTags(d.topTags);
          setTotal(d.total);
          setCursor(d.nextCursor);
          setPhase("ready");
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setPhase("error");
        });
    }, q ? 260 : 0);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [q, tag, tick]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    fetchPublicGroups({ q: q.trim() || undefined, tag: tag || undefined, cursor })
      .then((d) => {
        setGroups((p) => [...p, ...d.groups]);
        setCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore, q, tag]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return {
    q, setQ, tag, setTag, mine, groups, topTags, total,
    phase, loadingMore, hasMore: !!cursor, loadMore, reload,
  };
}
