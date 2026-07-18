import { useCallback, useEffect, useState } from "react";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { relayOutdated } from "@/lib/together/relay-version";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const safeFetch: typeof fetch = (input, init) =>
  isTauri
    ? (tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>)
    : fetch(input, init);

export type RelayTest = {
  ok: boolean;
  healthMs: number | null;
  workerVersion: number | null;
  needsUpdate: boolean;
  message: string;
};

export type PassiveRelayHealth = { version: number | null; needsUpdate: boolean } | null;

function httpBaseOf(url: string): string {
  return url
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/+$/, "");
}

async function fetchRelayVersion(
  url: string,
): Promise<{ healthMs: number; version: number | null }> {
  const t0 = performance.now();
  const r = await safeFetch(`${httpBaseOf(url)}/health`, { method: "GET" });
  const healthMs = Math.round(performance.now() - t0);
  if (!r.ok) throw new Error(`Worker health check returned ${r.status}`);
  let version: number | null = null;
  try {
    const body = (await r.json()) as { version?: number };
    if (typeof body.version === "number") version = body.version;
  } catch {
    version = 1;
  }
  return { healthMs, version };
}

export function useRelayHealth(relayUrl: string): {
  testing: boolean;
  testResult: RelayTest | null;
  runTest: () => Promise<void>;
  passive: PassiveRelayHealth;
} {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<RelayTest | null>(null);
  const [passive, setPassive] = useState<PassiveRelayHealth>(null);

  useEffect(() => {
    setTestResult(null);
    setPassive(null);
    if (!relayUrl) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const { version } = await fetchRelayVersion(relayUrl);
          if (!cancelled) setPassive({ version, needsUpdate: relayOutdated(version) });
        } catch {
          if (!cancelled) setPassive(null);
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [relayUrl]);

  const runTest = useCallback(async () => {
    if (!relayUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { healthMs, version } = await fetchRelayVersion(relayUrl);
      const needsUpdate = relayOutdated(version);
      const updateNote = needsUpdate
        ? ` Your relay is running an older version (v${version ?? "?"}). Redeploy to pick up the latest worker.`
        : "";
      setTestResult({
        ok: true,
        healthMs,
        workerVersion: version,
        needsUpdate,
        message: `Worker reachable in ${healthMs}ms.${updateNote}`,
      });
      setPassive({ version, needsUpdate });
    } catch (e) {
      setTestResult({
        ok: false,
        healthMs: null,
        workerVersion: null,
        needsUpdate: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  }, [relayUrl]);

  return { testing, testResult, runTest, passive };
}
