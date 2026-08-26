import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { authToken, currentAuthor, refreshToken, subscribeAuthor } from "@/lib/theme-auth";
import { fetchActivity, fetchBadges, fetchFriends, fetchSummary, ProfileNotFound } from "./profile-api";
import type { ActivityItem, Badge, Friend, LoadState, ProfileSummary } from "./profile-types";

const LIVE_INTERVAL_MS = 25000;

const LIVE_FIELDS = [
  "online",
  "presence",
  "lastActiveAt",
  "watching",
  "counts",
  "friendState",
  "mutualCount",
  "ratings",
  "showcase",
  "shownBadges",
  "verified",
  "hideVerified",
  "badges",
] as const;

function mergeLive(prev: ProfileSummary, next: ProfileSummary): ProfileSummary {
  let changed = false;
  const out = { ...prev };
  for (const k of LIVE_FIELDS) {
    const a = (prev as Record<string, unknown>)[k];
    const b = (next as Record<string, unknown>)[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    (out as Record<string, unknown>)[k] = b;
    changed = true;
  }
  return changed ? out : prev;
}

function keepIfEqual<T>(prev: T[], next: T[]): T[] {
  if (prev.length !== next.length) return next;
  for (let index = 0; index < prev.length; index++) {
    if (JSON.stringify(prev[index]) !== JSON.stringify(next[index])) return next;
  }
  return prev;
}

export type ProfileBundle = {
  state: LoadState;
  summary: ProfileSummary | null;
  friends: Friend[];
  badges: Badge[];
  activity: ActivityItem[];
  reload: () => void;
  patchSummary: (next: ProfileSummary) => void;
};

export function useProfile(handle: string): ProfileBundle {
  const { authKey } = useAuth();
  const [authorId, setAuthorId] = useState(() => currentAuthor()?.id ?? "");
  const [state, setState] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [nonce, setNonce] = useState(0);
  const healedForRef = useRef("");

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const patchSummary = useCallback((next: ProfileSummary) => setSummary(next), []);

  useEffect(() => subscribeAuthor(() => setAuthorId(currentAuthor()?.id ?? "")), []);

  useEffect(() => {
    if (!handle) return;
    const ac = new AbortController();
    setState("loading");
    setSummary(null);
    setFriends([]);
    setBadges([]);
    setActivity([]);
    fetchSummary(handle, ac.signal)
      .then((s) => {
        if (ac.signal.aborted) return;
        setSummary(s);
        setState("ready");
        const mine = currentAuthor()?.handle;
        if (mine && s.handle && s.handle.toLowerCase() === mine.toLowerCase() && !s.isOwner && authToken() && healedForRef.current !== handle) {
          healedForRef.current = handle;
          void refreshToken().then((ok) => {
            if (ok && !ac.signal.aborted) reload();
          });
        }
        void fetchFriends(handle, ac.signal).then((f) => !ac.signal.aborted && setFriends(f)).catch(() => {});
        void fetchBadges(handle, ac.signal).then((b) => !ac.signal.aborted && setBadges(b)).catch(() => {});
        void fetchActivity(handle, ac.signal).then((a) => !ac.signal.aborted && setActivity(a)).catch(() => {});
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setState(e instanceof ProfileNotFound ? "empty" : "error");
      });
    return () => ac.abort();
  }, [handle, authKey, authorId, nonce]);

  useEffect(() => {
    if (!handle || state !== "ready") return;
    const ac = new AbortController();
    let syncing = false;
    const sync = () => {
      if (document.visibilityState === "hidden" || syncing) return;
      syncing = true;
      void Promise.allSettled([
        fetchSummary(handle, ac.signal),
        fetchFriends(handle, ac.signal),
        fetchBadges(handle, ac.signal),
      ]).then(([summaryResult, friendsResult, badgesResult]) => {
        syncing = false;
        if (ac.signal.aborted) return;
        if (summaryResult.status === "fulfilled") {
          setSummary((prev) => (prev ? mergeLive(prev, summaryResult.value) : summaryResult.value));
        }
        if (friendsResult.status === "fulfilled") {
          setFriends((prev) => keepIfEqual(prev, friendsResult.value));
        }
        if (badgesResult.status === "fulfilled") {
          setBadges((prev) => keepIfEqual(prev, badgesResult.value));
        }
      });
    };
    const id = window.setInterval(sync, LIVE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ac.abort();
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handle, state]);

  return { state, summary, friends, badges, activity, reload, patchSummary };
}
