import { ensureRefreshed } from "./auth";
import { getSession, setSession } from "./session";

let inflight: Promise<void> | null = null;

async function tauriFetch(input: string, init?: RequestInit): Promise<Response> {
  if ("__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetchFn } = await import("@tauri-apps/plugin-http");
    return tauriFetchFn(input, init as Record<string, unknown>) as unknown as Response;
  }
  return fetch(input, init);
}

export function validateMalSession(): Promise<void> {
  if (inflight) return inflight;
  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run(): Promise<void> {
  const session = getSession();
  if (!session) return;
  try {
    const res = await tauriFetch("https://api.myanimelist.net/v2/users/@me", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.status === 401) {
      const refreshed = await ensureRefreshed();
      if (!refreshed) setSession(null);
    }
  } catch {
    if (!navigator.onLine) return;
    setSession(null);
  }
}
