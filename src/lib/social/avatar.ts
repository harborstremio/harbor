import { applyAvatarUrl, authToken } from "@/lib/theme-auth";
import type { ProfileSummary } from "@/views/profile/profile-types";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

async function unwrap(r: Response): Promise<ProfileSummary> {
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || "Could not update avatar.");
  return d as ProfileSummary;
}

export async function uploadAvatar(blob: Blob): Promise<ProfileSummary> {
  const token = authToken();
  if (!token) throw new Error("auth_required");
  const fd = new FormData();
  fd.append("avatar", blob, "avatar.webp");
  const r = await fetch(`${API}/social/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const summary = await unwrap(r);
  applyAvatarUrl(summary.avatarUrl ?? null);
  return summary;
}

export async function removeAvatar(): Promise<ProfileSummary> {
  const token = authToken();
  if (!token) throw new Error("auth_required");
  const r = await fetch(`${API}/social/profile/avatar/remove`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const summary = await unwrap(r);
  applyAvatarUrl(summary.avatarUrl ?? null);
  return summary;
}
