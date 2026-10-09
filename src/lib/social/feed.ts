import { socialGet } from "./client";

export type FeedActor = {
  handle: string;
  alias: string;
  avatarUrl?: string;
  online?: boolean;
};

export type FeedKind = "watched" | "finished" | "favorited" | "rated";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  title: string;
  posterUrl?: string;
  subtitle?: string;
  rating?: number;
  at: string;
  metaId: string;
  type?: "movie" | "series" | "anime" | "manga";
  actor: FeedActor;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor?: string;
  friendCount: number;
  sharingCount: number;
};

export type WatchingNow = {
  actor: FeedActor;
  since: string;
  watching: {
    kind: "watching" | "party";
    title?: string;
    sub?: string;
    posterUrl?: string;
    partySize?: number;
    paused?: boolean;
  };
};

export function fetchFriendsFeed(cursor?: string, signal?: AbortSignal): Promise<FeedPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return socialGet<FeedPage>(`/social/me/feed${qs}`, signal);
}

export function fetchFriendsWatching(signal?: AbortSignal): Promise<{ items: WatchingNow[] }> {
  return socialGet<{ items: WatchingNow[] }>("/social/me/watching", signal);
}
