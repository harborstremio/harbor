import { socialGet, socialPost } from "./client";

export type FriendEdge = { id: string; status: string };
export type Friend = {
  handle: string;
  alias: string;
  avatarUrl?: string;
  slogan?: string;
  online?: boolean;
  status?: string;
};
export type PendingRequest = {
  edgeId: string;
  from: { handle: string; alias: string; avatarUrl?: string };
  slogan?: string;
  createdAt: string;
};

export function sendFriendRequest(handle: string): Promise<{ edge: FriendEdge }> {
  return socialPost("/social/friends/request", { handle: handle.trim().toLowerCase() });
}

export function acceptFriend(edgeId: string): Promise<{ edge: FriendEdge }> {
  return socialPost(`/social/friends/${encodeURIComponent(edgeId)}/accept`);
}

export function declineFriend(edgeId: string): Promise<{ ok: boolean }> {
  return socialPost(`/social/friends/${encodeURIComponent(edgeId)}/decline`);
}

export function removeFriend(handle: string): Promise<{ ok: boolean }> {
  return socialPost("/social/friends/remove", { handle: handle.trim().toLowerCase() });
}

export function fetchFriends(signal?: AbortSignal): Promise<Friend[]> {
  return socialGet<{ friends?: Friend[] } | Friend[]>("/social/friends", signal).then((d) =>
    Array.isArray(d) ? d : d.friends ?? [],
  );
}

export function fetchPendingRequests(signal?: AbortSignal): Promise<PendingRequest[]> {
  return socialGet<{ pending?: PendingRequest[] } | PendingRequest[]>("/social/friends/pending", signal).then((d) =>
    Array.isArray(d) ? d : d.pending ?? [],
  );
}
