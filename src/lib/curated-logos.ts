import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const URL = `${HARBOR_API_BASE}/curated-logos.json`;

let map: Record<string, string> | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    const res = await safeFetch(URL);
    const j = res.ok ? ((await res.json()) as { logos?: Record<string, string> }) : null;
    map = j?.logos ?? {};
  } catch {
    map = {};
  }
}

export function ensureCuratedLogos(): Promise<void> {
  if (map) return Promise.resolve();
  if (!loading) loading = load();
  return loading;
}

export function peekCuratedLogo(id: string): string | undefined {
  return map?.[id];
}
