import { safeFetch } from "@/lib/safe-fetch";
import { authToken } from "@/lib/theme-auth";
import type { ProfileSummary } from "@/views/profile/profile-types";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const ENDPOINT = `${HARBOR_API_BASE}/themes/api/social/me/profile`;

export async function setPrivate(next: boolean): Promise<ProfileSummary> {
  const token = authToken();
  const res = await safeFetch(ENDPOINT, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ private: next }),
  });
  if (!res.ok) throw new Error(`privacy patch ${res.status}`);
  return (await res.json()) as ProfileSummary;
}
