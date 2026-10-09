import { useCallback, useEffect, useState } from "react";
import { fetchSummary, ProfileNotFound } from "@/views/profile/profile-api";
import type { ProfileSummary } from "@/views/profile/profile-types";
import type { FeaturedList } from "@/lib/social/featured-lists";

export type SharedListState = "loading" | "ready" | "missing" | "error";

export type SharedListBundle = {
  state: SharedListState;
  summary: ProfileSummary | null;
  list: FeaturedList | null;
  reload: () => void;
};

export function useSharedList(handle: string, listId: string): SharedListBundle {
  const [state, setState] = useState<SharedListState>("loading");
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [list, setList] = useState<FeaturedList | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!handle || !listId) return;
    const ac = new AbortController();
    setState("loading");
    setSummary(null);
    setList(null);
    fetchSummary(handle, ac.signal)
      .then((s) => {
        if (ac.signal.aborted) return;
        const found = (s.featuredLists ?? []).find((l) => l.id === listId) ?? null;
        setSummary(s);
        setList(found);
        setState(found ? "ready" : "missing");
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setState(e instanceof ProfileNotFound ? "missing" : "error");
      });
    return () => ac.abort();
  }, [handle, listId, nonce]);

  return { state, summary, list, reload };
}
