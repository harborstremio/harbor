// Placeholder until the hosted service launches (.invalid never resolves, RFC 2606).
// The settings UI requires a custom server URL while the official option is disabled.
export const DEFAULT_SYNC_ENDPOINT: string = "https://harbor-sync.invalid";

export type SyncDoc = {
  key: string;
  rev: number;
  ciphertext: string | null;
  updatedAt: number;
  deleted: 0 | 1;
};

export type PushDoc = {
  key: string;
  ciphertext: string | null;
  baseRev: number;
  updatedAt: number;
};

export type PushResult =
  | { key: string; status: "ok"; rev: number }
  | { key: string; status: "conflict"; doc: SyncDoc };

export class SyncApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "SyncApiError";
    this.code = code;
    this.status = status;
  }

  /**
   * True when this error means the stored token is no longer valid.
   * The server answers 401 both for expired/revoked tokens ("unauthorized")
   * and for a wrong password re-confirmation ("invalid_credentials", e.g. on
   * delete account or change password); only the former invalidates the session.
   */
  get invalidatesSession(): boolean {
    return this.status === 401 && this.code !== "invalid_credentials";
  }
}

export class SyncApi {
  private readonly endpoint: string;
  private readonly token: string | null;

  constructor(endpoint: string, token?: string | null) {
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.token = token ?? null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 15000);
    const headers = new Headers();

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody: unknown = await response.json().catch(() => null);
        const code =
          typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "string"
            ? responseBody.error
            : `http_${response.status}`;
        throw new SyncApiError(code, response.status);
      }

      return (await response.json()) as T;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  async prelogin(email: string): Promise<{ kdfIterations: number; kdfSalt: string }> {
    return this.request("POST", "/v1/auth/prelogin", { email });
  }

  async register(p: {
    email: string;
    authHash: string;
    kdfIterations: number;
    kdfSalt: string;
    wrappedDataKey: string;
    deviceName?: string;
  }): Promise<{ token: string; userId: string; syncRev: number }> {
    return this.request("POST", "/v1/auth/register", p);
  }

  async login(p: { email: string; authHash: string; deviceName?: string }): Promise<{
    token: string;
    userId: string;
    kdfIterations: number;
    kdfSalt: string;
    wrappedDataKey: string;
    syncRev: number;
  }> {
    return this.request("POST", "/v1/auth/login", p);
  }

  async logout(): Promise<void> {
    await this.request("POST", "/v1/auth/logout");
  }

  async changePassword(p: {
    authHash: string;
    newAuthHash: string;
    newKdfIterations: number;
    newKdfSalt: string;
    newWrappedDataKey: string;
  }): Promise<void> {
    await this.request("PUT", "/v1/auth/password", p);
  }

  async getDocs(since: number): Promise<{ rev: number; docs: SyncDoc[] }> {
    return this.request("GET", `/v1/sync/docs?since=${encodeURIComponent(since)}`);
  }

  async putDocs(docs: PushDoc[]): Promise<{ rev: number; results: PushResult[] }> {
    return this.request("PUT", "/v1/sync/docs", { docs });
  }

  async deleteAccount(authHash: string): Promise<void> {
    await this.request("DELETE", "/v1/account", { authHash });
  }
}
