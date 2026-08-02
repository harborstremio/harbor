import { isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const INDEX_URL = `${HARBOR_API_BASE}/updates/versions-beta.json`;

export type VersionEntry = {
  version: string;
  date?: string;
  notes?: string;
  win?: string;
  mac?: string;
  channel?: "beta" | "stable";
};

export const currentVersion = __APP_VERSION__;

export async function fetchVersionHistory(): Promise<VersionEntry[]> {
  const res = await safeFetch(INDEX_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`history ${res.status}`);
  const data = (await res.json()) as { versions?: VersionEntry[] };
  const list = Array.isArray(data.versions) ? data.versions : [];
  return list.filter((v) => v && typeof v.version === "string");
}

export function installerUrl(entry: VersionEntry): string | null {
  if (isWindowsDesktop()) return entry.win ?? null;
  if (isMacDesktop()) return entry.mac ?? null;
  return null;
}
