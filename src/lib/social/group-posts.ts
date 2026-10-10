import { socialDelete, socialGet, socialPatch, socialPost } from "./client";
import type { MiniUser } from "./groups";

export type GroupPost = {
  id: string;
  groupId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  editedAt?: string;
  author?: MiniUser;
  likeCount: number;
  liked: boolean;
  canDelete: boolean;
  canPin: boolean;
  canEdit?: boolean;
};

export type GroupPostPage = { posts: GroupPost[]; nextCursor?: string; canPost: boolean };

const base = (id: string) => `/social/groups/${encodeURIComponent(id)}/posts`;

export function fetchGroupPosts(
  id: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<GroupPostPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return socialGet<GroupPostPage>(`${base(id)}${qs}`, signal);
}

export function createGroupPost(id: string, body: string): Promise<GroupPost> {
  return socialPost<GroupPost>(base(id), { body: body.trim() });
}

export function editGroupPost(id: string, postId: string, body: string): Promise<GroupPost> {
  return socialPatch<GroupPost>(`${base(id)}/${encodeURIComponent(postId)}`, { body: body.trim() });
}

export function deleteGroupPost(id: string, postId: string): Promise<{ ok: boolean }> {
  return socialDelete<{ ok: boolean }>(`${base(id)}/${encodeURIComponent(postId)}`);
}

export function pinGroupPost(id: string, postId: string, pinned: boolean): Promise<GroupPost> {
  return socialPost<GroupPost>(`${base(id)}/${encodeURIComponent(postId)}/pin`, { pinned });
}

export function likeGroupPost(id: string, postId: string, liked: boolean): Promise<GroupPost> {
  const path = `${base(id)}/${encodeURIComponent(postId)}/like`;
  return liked ? socialPost<GroupPost>(path) : socialDelete<GroupPost>(path);
}
