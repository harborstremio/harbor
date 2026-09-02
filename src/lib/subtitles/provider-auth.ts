import { invoke } from "@tauri-apps/api/core";
import { SUBTITLE_PUBLIC_NETWORK_HEADER } from "./provider-url";

export type SubtitleDownloadAuthKind = "subsource-api-key" | "subdl-api-key";

export type SubtitleDownloadAuth = Readonly<{
  kind: SubtitleDownloadAuthKind;
  credentialId: string;
}>;

export type SubtitleCredentialRequest = {
  url: string;
  headers?: Record<string, string>;
};

type CredentialBinding = {
  kind: SubtitleDownloadAuthKind;
  apiKey: string;
  expiresAt: number;
};

const CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CREDENTIAL_BINDINGS = 512;
const INTERNAL_CREDENTIAL_HEADER = "X-Harbor-Subtitle-Credential";
const credentialBindings = new Map<string, CredentialBinding>();

function isNativeRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Raw provider keys are a browser-only compatibility path. Native callers
 * must use a vault handle so a failed bind cannot fall back to renderer URLs
 * or headers containing the key. */
export function browserSubtitleCredentialKey(
  apiKey: string | null | undefined,
): string | undefined {
  if (isNativeRuntime()) return undefined;
  return apiKey?.trim() || undefined;
}

function pruneCredentialBindings(now = Date.now()): void {
  for (const [id, binding] of credentialBindings) {
    if (binding.expiresAt <= now) credentialBindings.delete(id);
  }
  while (credentialBindings.size >= MAX_CREDENTIAL_BINDINGS) {
    const oldest = credentialBindings.keys().next().value as string | undefined;
    if (!oldest) break;
    credentialBindings.delete(oldest);
  }
}

function credentialId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean))
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isAuth(value: unknown, kind: SubtitleDownloadAuthKind): value is SubtitleDownloadAuth {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SubtitleDownloadAuth>;
  return (
    candidate.kind === kind &&
    typeof candidate.credentialId === "string" &&
    !!candidate.credentialId
  );
}

function exactProviderOrigin(kind: SubtitleDownloadAuthKind, rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    const expectedHost = kind === "subsource-api-key" ? "api.subsource.net" : "api.subdl.com";
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== expectedHost ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Bind one exact provider key to an opaque process-wide handle. Desktop and
 * mobile keep the key in Rust so a result can move between Harbor WebViews
 * without serializing the secret. The browser build keeps the same scoped
 * behavior in memory because it has no native process.
 */
export async function bindSubtitleDownloadAuth(
  kind: SubtitleDownloadAuthKind | undefined,
  apiKey: string | null | undefined,
): Promise<SubtitleDownloadAuth | undefined> {
  const normalized = apiKey?.trim();
  if (!kind || !normalized) return undefined;

  if (isNativeRuntime()) {
    try {
      const auth = await invoke<SubtitleDownloadAuth>("subtitle_credential_bind", {
        args: { kind, apiKey: normalized },
      });
      return isAuth(auth, kind) ? auth : undefined;
    } catch {
      return undefined;
    }
  }

  const now = Date.now();
  pruneCredentialBindings(now);
  const id = credentialId();
  credentialBindings.set(id, { kind, apiKey: normalized, expiresAt: now + CREDENTIAL_TTL_MS });
  return { kind, credentialId: id };
}

function browserBinding(auth: SubtitleDownloadAuth): CredentialBinding | undefined {
  const binding = credentialBindings.get(auth.credentialId);
  if (!binding || binding.kind !== auth.kind) return undefined;
  if (binding.expiresAt <= Date.now()) {
    credentialBindings.delete(auth.credentialId);
    return undefined;
  }
  return binding;
}

/** Build an origin-scoped provider request without exposing native secrets. */
export function subtitleCredentialRequest(
  rawUrl: string,
  auth: SubtitleDownloadAuth | undefined,
): SubtitleCredentialRequest | undefined {
  if (!auth?.credentialId) return undefined;
  const url = exactProviderOrigin(auth.kind, rawUrl);
  if (!url) return undefined;

  if (isNativeRuntime()) {
    return {
      url: url.href,
      headers: { [INTERNAL_CREDENTIAL_HEADER]: auth.credentialId },
    };
  }

  const binding = browserBinding(auth);
  if (!binding) return undefined;
  if (auth.kind === "subsource-api-key") {
    return { url: url.href, headers: { "X-API-Key": binding.apiKey } };
  }
  if ([...url.searchParams.keys()].some((name) => name.toLowerCase() === "api_key")) {
    return undefined;
  }
  url.searchParams.append("api_key", binding.apiKey);
  return { url: url.href };
}

/**
 * Download call sites use this compatibility helper. Native code validates the
 * actual request URL again before resolving the handle. Browser callers should
 * pass the URL so the same exact-origin rule is enforced before exposing a key.
 */
export function subtitleDownloadHeaders(
  auth: SubtitleDownloadAuth | undefined,
  rawUrl: string,
): Record<string, string> | undefined {
  return subtitleCredentialRequest(rawUrl, auth)?.headers;
}

export function providerSubtitleDownloadHeaders(
  auth: SubtitleDownloadAuth | undefined,
  rawUrl: string,
): Record<string, string> {
  const remoteProviderUrl = /^https?:\/\//iu.test(rawUrl);
  return {
    ...subtitleCredentialRequest(rawUrl, auth)?.headers,
    ...(remoteProviderUrl ? { [SUBTITLE_PUBLIC_NETWORK_HEADER]: "1" } : {}),
  };
}

export function subtitleTrackDownloadHeaders(
  auth: SubtitleDownloadAuth | undefined,
  rawUrl: string,
  providerDerived: boolean,
): Record<string, string> | undefined {
  return providerDerived
    ? providerSubtitleDownloadHeaders(auth, rawUrl)
    : subtitleDownloadHeaders(auth, rawUrl);
}

export async function clearSubtitleDownloadCredentials(): Promise<void> {
  credentialBindings.clear();
  if (!isNativeRuntime()) return;
  await invoke("subtitle_credentials_clear").catch(() => {});
}
