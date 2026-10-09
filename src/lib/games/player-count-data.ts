import { GameRequestPool } from "./request-pool";

export type GamePlayerCount = { appId: number; currentPlayers: number; playersObservedAt: number };
export const PLAYER_COUNT_TTL = 120_000;

export function parseCurrentPlayers(value: unknown): number {
  const result = value as { response?: { result?: unknown; player_count?: unknown } } | null;
  const count = result?.response?.player_count;
  if (result?.response?.result !== 1 || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw Error("Player count unavailable");
  return count;
}

type Pending = { controller: AbortController; task: Promise<GamePlayerCount>; users: number; done: boolean };
/** Ephemeral observations: never restore a disk snapshot as a current player count. */
export class GamePlayerCounts {
  private cache = new Map<number, GamePlayerCount>();
  private pending = new Map<number, Pending>();
  private failures = new Map<number, number>();
  private pool = new GameRequestPool(3);
  private request: (appId: number, signal: AbortSignal) => Promise<unknown>;
  private now: () => number;
  constructor(request: (appId: number, signal: AbortSignal) => Promise<unknown>, now = Date.now) { this.request = request; this.now = now; }

  async load(ids: readonly number[], signal?: AbortSignal): Promise<GamePlayerCount[]> {
    signal?.throwIfAborted();
    const appIds = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff).slice(0, 12);
    const results = await Promise.allSettled(appIds.map(id => this.get(id, signal)));
    signal?.throwIfAborted();
    return results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  }

  private get(appId: number, signal?: AbortSignal): Promise<GamePlayerCount> {
    const cached = this.cache.get(appId), now = this.now();
    if (cached && now >= cached.playersObservedAt && now - cached.playersObservedAt < PLAYER_COUNT_TTL) return Promise.resolve({ ...cached });
    const failure = this.failures.get(appId);
    if (failure !== undefined && now >= failure && now - failure < 15_000) return Promise.reject(Error("Player count unavailable"));
    let entry = this.pending.get(appId);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      entry = { controller, users: 0, done: false, task: null! };
      const current = entry;
      current.task = this.pool.run(async () => {
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const raw = await this.request(appId, controller.signal);
          controller.signal.throwIfAborted();
          const value = { appId, currentPlayers: parseCurrentPlayers(raw), playersObservedAt: this.now() };
          this.cache.delete(appId); this.cache.set(appId, value); this.failures.delete(appId);
          if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value!);
          return value;
        } finally { clearTimeout(timer); }
      }, controller.signal).catch(error => {
        if (!controller.signal.aborted) {
          this.failures.delete(appId); this.failures.set(appId, this.now());
          if (this.failures.size > 100) this.failures.delete(this.failures.keys().next().value!);
        }
        throw error;
      }).finally(() => { current.done = true; if (this.pending.get(appId) === current) this.pending.delete(appId); });
      this.pending.set(appId, current);
    }
    const current = entry;
    current.users += 1;
    return new Promise((resolve, reject) => {
      let ended = false;
      const finish = () => {
        if (ended) return false;
        ended = true; signal?.removeEventListener("abort", abort); current.users -= 1;
        if (!current.users && !current.done) current.controller.abort();
        return true;
      };
      const abort = () => { if (finish()) reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
      signal?.addEventListener("abort", abort, { once: true });
      current.task.then(value => { if (finish()) resolve({ ...value }); }, error => { if (finish()) reject(error); });
      if (signal?.aborted) abort();
    });
  }
}
