export type ApiSport = "football" | "hockey";
export type ApiSportsStatus = {
  code: "ready" | "missing-key" | "invalid-key" | "quota" | "rate-limit" | "unavailable";
  retryAt?: number;
};
type Row = Record<string, any>;
type Options = {
  getKey: () => string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  timeoutMs?: number;
};
const HOSTS = {
  football: "https://v3.football.api-sports.io",
  hockey: "https://v1.hockey.api-sports.io",
};
const object = (value: unknown): value is Row =>
  !!value && typeof value === "object" && !Array.isArray(value);
export class ApiSportsError extends Error {
  readonly code: ApiSportsStatus["code"];
  constructor(code: ApiSportsStatus["code"]) {
    super(`API-Sports ${code}`);
    this.name = "ApiSportsError";
    this.code = code;
  }
}

/** Access keys never enter cache keys, status messages, URLs, or persistent storage here. */
export function createApiSportsTransport(options: Options) {
  const now = options.now ?? Date.now;
  let credential = "",
    generation = 0;
  const controllers = new Set<AbortController>();
  const listeners = new Set<() => void>();
  const states = new Map<ApiSport, ApiSportsStatus>();
  const budgets = new Map<ApiSport, { remaining: number; reset: number }>();
  const queues = new Map<ApiSport, Promise<unknown>>();
  let waiting = 0;
  let rejected = false;
  const publish = (sport: ApiSport, status: ApiSportsStatus) => {
    const old = states.get(sport);
    if (old?.code === status.code && old.retryAt === status.retryAt) return;
    states.set(sport, status);
    for (const listener of listeners) listener();
  };
  const refresh = () => {
    const key = options.getKey().trim();
    if (credential !== key) {
      credential = key;
      generation++;
      rejected = false;
      budgets.clear();
      states.clear();
      for (const controller of controllers) controller.abort();
      controllers.clear();
      for (const listener of listeners) listener();
    }
    return generation;
  };
  const resetAt = () => {
    const date = new Date(now());
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  };
  function status(sport: ApiSport): ApiSportsStatus {
    refresh();
    if (!credential) return { code: "missing-key" };
    if (rejected) return { code: "invalid-key" };
    const current = states.get(sport);
    if (current?.retryAt && current.retryAt <= now()) return { code: "ready" };
    return current ?? { code: "ready" };
  }
  async function request(sport: ApiSport, path: string, signal?: AbortSignal): Promise<Row[]> {
    signal?.throwIfAborted();
    const version = refresh(),
      key = credential;
    const previous = status(sport);
    if (["missing-key", "invalid-key", "quota", "rate-limit"].includes(previous.code))
      throw new ApiSportsError(previous.code);
    // Only this adapter's relative, read-only endpoints may receive the credential.
    if (
      !/^\/(?:fixtures|games)(?:\/(?:events|lineups|statistics|players))?\?[a-zA-Z0-9%=&:_.+-]+$/.test(
        path,
      )
    )
      throw new ApiSportsError("unavailable");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    controllers.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const work = (async () => {
      const response = await options.fetch(HOSTS[sport] + path, {
        headers: { "x-apisports-key": key },
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (version !== refresh()) throw new DOMException("Credential changed", "AbortError");
      const remainingHeader = response.headers.get("x-ratelimit-requests-remaining");
      const remaining = remainingHeader === null ? NaN : Number(remainingHeader);
      if (Number.isFinite(remaining) && remaining >= 0)
        budgets.set(sport, { remaining, reset: resetAt() });
      const minuteHeader = response.headers.get("x-ratelimit-remaining");
      let next: ApiSportsStatus =
        remaining <= 0
          ? { code: "quota", retryAt: resetAt() }
          : minuteHeader !== null && Number(minuteHeader) <= 0
            ? { code: "rate-limit", retryAt: now() + 60_000 }
            : { code: "ready" };
      if (response.status === 401) {
        rejected = true;
        publish(sport, { code: "invalid-key" });
        throw new ApiSportsError("invalid-key");
      }
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const seconds =
          retry !== null && /^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) * 1000 : NaN;
        const deadline = Number.isFinite(seconds)
          ? now() + seconds
          : retry
            ? Date.parse(retry)
            : NaN;
        if (next.code !== "quota")
          next = {
            code: "rate-limit",
            retryAt: Number.isFinite(deadline) ? Math.max(now() + 1000, deadline) : now() + 60_000,
          };
        publish(sport, next);
        throw new ApiSportsError(next.code);
      }
      if (!response.ok) throw new ApiSportsError("unavailable");
      const data: unknown = await response.json();
      controller.signal.throwIfAborted();
      if (version !== refresh()) throw new DOMException("Credential changed", "AbortError");
      if (!object(data) || (!Array.isArray(data.errors) && !object(data.errors)))
        throw new ApiSportsError("unavailable");
      if (Object.keys(data.errors).length) {
        const fields = (
          Object.keys(data.errors).join(" ") +
          " " +
          JSON.stringify(data.errors)
        ).toLowerCase();
        // Do not surface provider messages: they may echo authentication/request details.
        if (/token|authentication|api.?key/.test(fields)) {
          rejected = true;
          next = { code: "invalid-key" };
        } else if (/ratelimit|rate_limit|per.minute|too many/.test(fields))
          next = { code: "rate-limit", retryAt: now() + 60_000 };
        else if (/requests|quota|daily/.test(fields)) next = { code: "quota", retryAt: resetAt() };
        else next = { code: "unavailable" };
        publish(sport, next);
        throw new ApiSportsError(next.code);
      }
      if (
        !Array.isArray(data.response) ||
        data.response.some((row) => !object(row)) ||
        (object(data.paging) && Number(data.paging.total) > 1)
      )
        throw new ApiSportsError("unavailable");
      publish(sport, next);
      return data.response;
    })();
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          abort = () => reject(new DOMException("Request cancelled", "AbortError"));
          controller.signal.addEventListener("abort", abort, { once: true });
          timer = setTimeout(() => {
            publish(sport, { code: "unavailable" });
            controller.abort();
          }, options.timeoutMs ?? 12_000);
        }),
      ]);
    } catch (error) {
      if (version === refresh() && !(error instanceof ApiSportsError) && !controller.signal.aborted)
        publish(sport, { code: "unavailable" });
      if (error instanceof ApiSportsError && error.code === "unavailable" && version === generation)
        publish(sport, { code: "unavailable" });
      throw error instanceof ApiSportsError ? error : new ApiSportsError("unavailable");
    } finally {
      clearTimeout(timer);
      if (abort) controller.signal.removeEventListener("abort", abort);
      signal?.removeEventListener("abort", cancel);
      controllers.delete(controller);
    }
  }
  function get(sport: ApiSport, path: string, signal?: AbortSignal): Promise<Row[]> {
    if (signal?.aborted) return Promise.reject(new DOMException("Request cancelled", "AbortError"));
    const version = refresh();
    if (waiting >= 40) return Promise.reject(new ApiSportsError("unavailable"));
    waiting++;
    // Serialize each product so the next call observes quota/auth headers from the previous one.
    const task = (queues.get(sport) ?? Promise.resolve())
      .catch(() => {})
      .then(() => {
        signal?.throwIfAborted();
        if (version !== refresh()) throw new ApiSportsError("unavailable");
        return request(sport, path, signal);
      })
      .finally(() => {
        waiting--;
        if (queues.get(sport) === task) queues.delete(sport);
      });
    queues.set(sport, task);
    return task;
  }
  return {
    get,
    generation: refresh,
    status,
    refresh,
    remaining(sport: ApiSport) {
      refresh();
      const b = budgets.get(sport);
      return b && b.reset > now() ? b.remaining : Infinity;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
