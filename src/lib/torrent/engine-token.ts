import { invoke } from "@tauri-apps/api/core";

/**
 * Access key for the bundled torrent engine's HTTP routes.
 *
 * The engine answers on localhost and, while casting, on the LAN. Two of its
 * routes add a torrent as a side effect, so an unauthenticated `GET` was enough
 * for any web page or LAN host to make this machine download and seed content
 * of someone else's choosing. Every URL Harbor builds for the engine carries
 * this key; requests without it are refused.
 *
 * A user-configured *remote* stream server is somebody else's engine — it has
 * its own key, so we never attach ours to those URLs.
 */
let token = "";
let inflight: Promise<string> | null = null;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function primeEngineToken(): Promise<string> {
  if (token || !isTauri) return Promise.resolve(token);
  if (!inflight) {
    inflight = invoke<string>("torrent_engine_token")
      .then((t) => {
        token = t ?? "";
        return token;
      })
      .catch(() => "")
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function engineToken(): string {
  return token;
}

export function isLocalEngineBase(base: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(base.replace(/\/+$/, ""));
}

/** Append the engine key to a URL that points at *our* engine. */
export function withEngineToken(url: string, key = engineToken()): string {
  if (!key) return url;
  return `${url}${url.includes("?") ? "&" : "?"}tok=${encodeURIComponent(key)}`;
}
