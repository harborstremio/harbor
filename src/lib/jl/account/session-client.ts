/** Supabase REST session lifecycle, independent of React and build-time configuration. */
export type JlSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string | null;
};

export type JlAccountContext = { userId: string; generation: number };
export const SESSION_KEY = "jl.account.session.v1";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error_description?: string;
  msg?: string;
  code?: string;
  error_code?: string;
};

class AuthError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code: string | undefined) {
    super(message);
    this.code = code;
  }
}

export function createJlSessionClient(options: {
  url: string;
  anonKey: string;
  storage: StoragePort;
  fetch: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  beforeIdentityChange?: (
    previous: JlSession | null,
    next: JlSession | null,
  ) => void | (() => void);
  /** Return true when the host is synchronously remounting/reloading and old subscribers must stay parked. */
  onIdentityChange?: () => boolean | void;
}) {
  const url = options.url.trim().replace(/\/+$/, "");
  const anonKey = options.anonKey.trim();
  const now = options.now ?? Date.now;
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; session: JlSession | null } | null = null;
  let memoryOnly = false;
  let generation = 0;
  let identityReloading = false;
  let refreshing: { generation: number; promise: Promise<JlSession | null> } | null = null;
  const configured = () => !!url && !!anonKey;
  const notify = () => {
    if (!identityReloading) for (const listener of listeners) listener();
  };

  function read(): JlSession | null {
    if (memoryOnly) return cache?.session ?? null;
    let raw: string | null;
    try {
      raw = options.storage.getItem(SESSION_KEY);
    } catch {
      return cache?.session ?? null;
    }
    if (cache?.raw === raw) return cache.session;
    let session: JlSession | null = null;
    try {
      const v = raw ? (JSON.parse(raw) as Partial<JlSession>) : null;
      if (
        v &&
        typeof v.accessToken === "string" &&
        v.accessToken &&
        typeof v.refreshToken === "string" &&
        v.refreshToken &&
        typeof v.userId === "string" &&
        v.userId
      ) {
        session = {
          accessToken: v.accessToken,
          refreshToken: v.refreshToken,
          userId: v.userId,
          expiresAt: Number(v.expiresAt) || 0,
          email: typeof v.email === "string" ? v.email : null,
        };
      }
    } catch {
      /* Damaged storage is treated as signed out. */
    }
    const identityChanged = !!cache && cache.session?.userId !== session?.userId;
    if (cache) {
      if (identityChanged) {
        generation++;
        options.beforeIdentityChange?.(cache.session, session);
      }
    }
    cache = { raw, session };
    if (identityChanged) identityReloading = options.onIdentityChange?.() === true;
    return session;
  }

  function write(session: JlSession | null): void {
    const identityChanged = cache?.session?.userId !== session?.userId;
    const rollback = identityChanged
      ? options.beforeIdentityChange?.(cache?.session ?? null, session)
      : undefined;
    const raw = session ? JSON.stringify(session) : null;
    try {
      if (raw) options.storage.setItem(SESSION_KEY, raw);
      else options.storage.removeItem(SESSION_KEY);
      memoryOnly = false;
    } catch (error) {
      if (identityChanged && options.beforeIdentityChange) {
        rollback?.();
        throw new Error(
          "JL account could not be saved on this device. Free some storage and try again.",
          { cause: error },
        );
      }
      memoryOnly = true;
    }
    cache = { raw, session };
    if (identityChanged) identityReloading = options.onIdentityChange?.() === true;
    notify();
  }

  function context(): JlAccountContext | null {
    const session = read();
    return session ? { userId: session.userId, generation } : null;
  }
  function isCurrent(expected: JlAccountContext): boolean {
    const current = context();
    return current?.userId === expected.userId && current.generation === expected.generation;
  }
  function assertCurrent(expected: JlAccountContext): void {
    if (!isCurrent(expected)) throw new Error("JL account changed. Try again.");
  }
  function requireConfigured(): void {
    if (!configured()) throw new Error("JL accounts are not configured in this build.");
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (init.signal?.aborted) abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15_000);
    try {
      const response = await options.fetch(`${url}${path}`, { ...init, signal: controller.signal });
      // Account endpoints carry bounded JSON. Include the response body in the
      // deadline so stalled headers/body cannot leave the login form busy forever.
      const body = await response.arrayBuffer();
      if (body.byteLength > 4_000_000) throw new Error("JL account response is too large.");
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (timedOut) throw new Error("JL account request timed out. Try again.");
      throw error;
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
  }

  function toSession(body: TokenResponse): JlSession | null {
    if (!body.access_token || !body.refresh_token || !body.user?.id) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      userId: body.user.id,
      expiresAt: body.expires_at ?? Math.floor(now() / 1000) + (body.expires_in ?? 3600),
      email: body.user.email ?? null,
    };
  }
  async function authRequest(
    path: string,
    payload: Record<string, string>,
  ): Promise<TokenResponse> {
    requireConfigured();
    const res = await request(`/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok)
      throw new AuthError(
        body.error_description || body.msg || `JL account request failed (${res.status})`,
        body.code ?? body.error_code,
      );
    return body;
  }
  async function tokenRequest(grant: string, payload: Record<string, string>): Promise<JlSession> {
    const session = toSession(await authRequest(`token?grant_type=${grant}`, payload));
    if (!session) throw new Error("JL account returned an invalid session. Try again.");
    return session;
  }
  async function signIn(email: string, password: string): Promise<JlSession> {
    read();
    const attempt = ++generation;
    const session = await tokenRequest("password", { email: email.trim(), password });
    if (attempt !== generation) throw new Error("JL account changed. Try again.");
    write(session);
    return session;
  }
  async function signUp(email: string, password: string): Promise<JlSession | null> {
    read();
    const attempt = ++generation;
    const session = toSession(await authRequest("signup", { email: email.trim(), password }));
    if (attempt !== generation) throw new Error("JL account changed. Try again.");
    if (session) write(session);
    return session;
  }
  async function signOut(): Promise<void> {
    const session = read();
    generation++;
    write(null);
    if (session && configured())
      await request("/auth/v1/logout?scope=local", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => {});
  }
  async function fresh(force = false): Promise<JlSession | null> {
    const session = read();
    if (!session) return null;
    if (!force && session.expiresAt - 60 > now() / 1000) return session;
    const expected = context()!;
    if (refreshing?.generation === expected.generation) return refreshing.promise;
    const run = {
      generation: expected.generation,
      promise: Promise.resolve(null) as Promise<JlSession | null>,
    };
    run.promise = tokenRequest("refresh_token", { refresh_token: session.refreshToken })
      .then((next) => {
        if (!isCurrent(expected)) return null;
        if (next.userId !== expected.userId)
          throw new Error("JL refresh returned a different account.");
        write(next);
        return next;
      })
      .catch((error: unknown) => {
        // Network/service failures retain the session. Only explicit session revocation clears it.
        if (
          isCurrent(expected) &&
          error instanceof AuthError &&
          [
            "refresh_token_not_found",
            "refresh_token_already_used",
            "session_not_found",
            "session_expired",
          ].includes(error.code ?? "")
        ) {
          generation++;
          write(null);
        }
        return null;
      })
      .finally(() => {
        if (refreshing === run) refreshing = null;
      });
    refreshing = run;
    return run.promise;
  }
  async function rest(
    path: string,
    init: RequestInit = {},
    expected = context(),
  ): Promise<Response> {
    if (!expected) throw new Error("Not signed in");
    assertCurrent(expected);
    const session = await fresh();
    assertCurrent(expected);
    if (!session) throw new Error("JL session could not be refreshed. Try again when online.");
    const headers = new Headers(init.headers);
    headers.set("apikey", anonKey);
    headers.set("Authorization", `Bearer ${session.accessToken}`);
    headers.set("Accept-Profile", "media");
    headers.set("Content-Profile", "media");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    let res = await request(`/rest/v1/${path}`, { ...init, headers });
    if (res.status === 401) {
      assertCurrent(expected);
      const renewed = await fresh(true);
      assertCurrent(expected);
      if (renewed) {
        headers.set("Authorization", `Bearer ${renewed.accessToken}`);
        res = await request(`/rest/v1/${path}`, { ...init, headers });
      }
    }
    assertCurrent(expected);
    return res;
  }
  async function rpc<T>(
    fn: string,
    args: Record<string, unknown> = {},
    expected = context(),
  ): Promise<T> {
    const res = await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }, expected);
    if (!res.ok) throw new Error(`JL request failed (${res.status})`);
    const text = await res.text();
    if (expected) assertCurrent(expected);
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    read,
    context,
    isCurrent,
    assertCurrent,
    configured,
    signIn,
    signUp,
    signOut,
    fresh,
    rest,
    rpc,
    resetPassword: async (email: string) => {
      await authRequest("recover", { email: email.trim() });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    storageChanged() {
      memoryOnly = false;
      read();
      notify();
    },
  };
}
