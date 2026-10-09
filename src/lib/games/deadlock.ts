import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { deadlockLanguage, deadlockStatsUrl, parseDeadlockHeroes, parseDeadlockStats, DEADLOCK_STATS_TTL } from "./deadlock-data";

const MAX_BYTES = 3 * 1024 * 1024;
let retryAt = 0;
export const deadlockRequests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("Deadlock rate limit");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Deadlock API ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) {
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) throw Error("Hero response too large");
    return JSON.parse(body) as unknown;
  }
  const decoder = new TextDecoder(); let body = "", size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > MAX_BYTES) throw Error("Hero response too large");
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});

export async function loadDeadlockCompanion(language: string, signal: AbortSignal, refresh = false) {
  const window = deadlockStatsUrl(Date.now());
  const [heroes, stats] = await Promise.allSettled([
    deadlockRequests.get(`https://api.deadlock-api.com/v1/assets/heroes?only_active=true&language=${deadlockLanguage(language)}`, refresh ? 0 : 6 * 3600_000, parseDeadlockHeroes, signal),
    deadlockRequests.get(window.url, refresh ? 0 : DEADLOCK_STATS_TTL, parseDeadlockStats, signal),
  ]);
  signal.throwIfAborted();
  if (heroes.status === "rejected") throw heroes.reason;
  return { heroes: heroes.value.data, stats: stats.status === "fulfilled" ? stats.value.data : [], statsUnavailable: stats.status === "rejected",
    from: window.from, to: window.to, observedAt: stats.status === "fulfilled" ? stats.value.at : heroes.value.at };
}
export type DeadlockCompanionData = Awaited<ReturnType<typeof loadDeadlockCompanion>>;
