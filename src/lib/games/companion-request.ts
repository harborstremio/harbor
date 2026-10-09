import { GameRequestPool } from "./request-pool";

export type CompanionObservation<T> = { data: T; at: number };
type Pending = { controller: AbortController; task: Promise<CompanionObservation<unknown>>; users: number; done: boolean };

/** Shared, bounded observations. A closing page only cancels work with no remaining readers. */
export class CompanionRequests {
  private cache = new Map<string, CompanionObservation<unknown>>();
  private pending = new Map<string, Pending>();
  private pool = new GameRequestPool(2);
  private request: (url: string, signal: AbortSignal) => Promise<unknown>;
  private now: () => number;
  private timeoutMs: number;
  constructor(request: (url: string, signal: AbortSignal) => Promise<unknown>, now = Date.now, timeoutMs = 15_000) { this.request = request; this.now = now; this.timeoutMs = timeoutMs; }

  get<T>(url: string, ttl: number, parse: (raw: unknown) => T, signal: AbortSignal): Promise<CompanionObservation<T>> {
    signal.throwIfAborted();
    const cached = this.cache.get(url), now = this.now();
    if (cached && now >= cached.at && now - cached.at < ttl) return Promise.resolve(cached as CompanionObservation<T>);
    let entry = this.pending.get(url);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      entry = { controller, task: null!, users: 0, done: false };
      const current = entry;
      current.task = this.pool.run(async () => {
        const budget = AbortSignal.any([controller.signal, AbortSignal.timeout(this.timeoutMs)]);
        const raw = await this.request(url, budget);
        budget.throwIfAborted();
        const observation = { data: parse(raw), at: this.now() };
        this.cache.delete(url); this.cache.set(url, observation);
        while (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value!);
        return observation;
      }, controller.signal).finally(() => { current.done = true; if (this.pending.get(url) === current) this.pending.delete(url); });
      this.pending.set(url, current);
    }
    const shared = entry;
    shared.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true; signal.removeEventListener("abort", abort); shared.users--;
        if (!shared.users && !shared.done) shared.controller.abort();
        return true;
      };
      const abort = () => { if (finish()) reject(signal.reason); };
      signal.addEventListener("abort", abort, { once: true });
      shared.task.then(value => { if (finish()) resolve(value as CompanionObservation<T>); }, error => { if (finish()) reject(error); });
      if (signal.aborted) abort();
    });
  }
}
