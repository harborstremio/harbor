import { socialGet, socialPost, socialPatch } from "./client";
import { authToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

export type GroupRole = "owner" | "admin" | "manager" | "member";

export const ROLE_RANK: Record<GroupRole, number> = { owner: 3, admin: 2, manager: 1, member: 0 };

export type GroupMember = {
  userId: string;
  handle: string;
  alias: string;
  avatarUrl?: string;
  slogan?: string;
  online?: boolean;
  role: GroupRole;
};

export type GroupPerms = {
  invite: boolean;
  post: boolean;
  moderatePosts: boolean;
  manageRoles: boolean;
  kick: boolean;
  editGroup: boolean;
  deleteGroup: boolean;
};

export type GroupVisibility = "public" | "invite";

export type MiniUser = {
  userId: string;
  handle: string;
  alias: string;
  avatarUrl?: string;
  verified?: boolean;
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  visibility: GroupVisibility;
  tags: string[];
  ownerId: string;
  owner?: MiniUser;
  memberPreview?: MiniUser[];
  memberCount: number;
  createdAt: string;
  isOwner: boolean;
  isMember: boolean;
  isPending?: boolean;
};

export type GroupCustomization = {
  customEnabled?: boolean;
  groupFont?: string;
  pageBgColor?: string;
  pageBgImage?: string;
  bannerUrl?: string;
  customHtml?: string;
  customCss?: string;
  canvasHeight?: number;
};

export type GroupDetail = Group &
  GroupCustomization & { members: GroupMember[]; myRole?: GroupRole; can?: GroupPerms };

export function groupPerms(d: GroupDetail): GroupPerms {
  if (d.can) return d.can;
  const role: GroupRole = d.isOwner ? "owner" : (d.myRole ?? (d.isMember ? "member" : "member"));
  const r = ROLE_RANK[role];
  return {
    invite: r >= ROLE_RANK.manager,
    post: d.isMember || d.isOwner,
    moderatePosts: r >= ROLE_RANK.manager,
    manageRoles: r >= ROLE_RANK.admin,
    kick: r >= ROLE_RANK.admin,
    editGroup: r >= ROLE_RANK.admin,
    deleteGroup: role === "owner",
  };
}

export function myGroupRole(d: GroupDetail): GroupRole {
  return d.isOwner ? "owner" : (d.myRole ?? "member");
}

export function setMemberRole(id: string, userId: string, role: GroupRole): Promise<GroupDetail> {
  return socialPatch<GroupDetail>(
    `/social/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/role`,
    { role },
  );
}

export type DiscoverGroups = {
  groups: Group[];
  topTags: string[];
  nextCursor?: string;
  total: number;
};

export function createGroup(
  name: string,
  opts?: { description?: string; visibility?: GroupVisibility; tags?: string[] },
): Promise<GroupDetail> {
  return socialPost<GroupDetail>("/social/groups", {
    name: name.trim(),
    description: opts?.description?.trim(),
    visibility: opts?.visibility,
    tags: opts?.tags,
  });
}

export type GroupPatch = {
  name?: string;
  description?: string;
  visibility?: GroupVisibility;
  tags?: string[];
} & GroupCustomization;

export function editGroup(id: string, patch: GroupPatch): Promise<GroupDetail> {
  return socialPatch<GroupDetail>(`/social/groups/${encodeURIComponent(id)}`, patch);
}

export function fetchPublicGroups(
  opts: { q?: string; tag?: string; cursor?: string } = {},
  signal?: AbortSignal,
): Promise<DiscoverGroups> {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.tag) p.set("tag", opts.tag);
  if (opts.cursor) p.set("cursor", opts.cursor);
  const qs = p.toString();
  return socialGet<DiscoverGroups>(`/social/groups/discover${qs ? `?${qs}` : ""}`, signal);
}

export function fetchGroupInvites(signal?: AbortSignal): Promise<Group[]> {
  return socialGet<{ groups?: Group[] } | Group[]>("/social/groups/invites", signal).then((d) =>
    Array.isArray(d) ? d : (d.groups ?? []),
  );
}

export function respondToInvite(
  id: string,
  accept: boolean,
): Promise<GroupDetail | { ok: boolean }> {
  return socialPost<GroupDetail | { ok: boolean }>(
    `/social/groups/${encodeURIComponent(id)}/respond`,
    { accept },
  );
}

export function fetchMyGroups(signal?: AbortSignal): Promise<Group[]> {
  return socialGet<{ groups?: Group[] } | Group[]>("/social/groups/mine", signal).then((d) =>
    Array.isArray(d) ? d : (d.groups ?? []),
  );
}

export function fetchUserGroups(handle: string, signal?: AbortSignal): Promise<Group[]> {
  return socialGet<Group[]>(`/social/groups/user/${encodeURIComponent(handle)}`, signal);
}

export function fetchGroup(id: string, signal?: AbortSignal): Promise<GroupDetail> {
  return socialGet<GroupDetail>(`/social/groups/${encodeURIComponent(id)}`, signal);
}

export function joinGroup(id: string): Promise<GroupDetail> {
  return socialPost<GroupDetail>(`/social/groups/${encodeURIComponent(id)}/join`);
}

export function leaveGroup(id: string): Promise<{ ok: boolean }> {
  return socialPost<{ ok: boolean }>(`/social/groups/${encodeURIComponent(id)}/leave`);
}

export function removeMember(id: string, userId: string): Promise<GroupDetail> {
  return socialPost<GroupDetail>(`/social/groups/${encodeURIComponent(id)}/remove`, { userId });
}

export function addGroupMember(id: string, handle: string): Promise<GroupDetail> {
  return socialPost<GroupDetail>(`/social/groups/${encodeURIComponent(id)}/add`, { handle });
}

export async function deleteGroup(id: string): Promise<{ ok: boolean }> {
  const token = authToken();
  const r = await fetch(`${API}/social/groups/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!r.ok) throw new Error(d.error || "Could not delete group.");
  return { ok: d.ok !== false };
}

export async function setGroupAvatar(id: string, blob: Blob): Promise<GroupDetail> {
  const token = authToken();
  const fd = new FormData();
  fd.append("avatar", blob, "avatar.webp");
  const r = await fetch(`${API}/social/groups/${encodeURIComponent(id)}/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const d = (await r.json().catch(() => ({}))) as GroupDetail & { error?: string };
  if (!r.ok) throw new Error(d.error || "Could not update group photo.");
  return d;
}
