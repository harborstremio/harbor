import { CompanionRequests } from "./companion-request";
import { APP_VERSION } from "../build-info";
import { GuideSourceNotFound } from "./guide-source-status";

export const POKEMON_API = "https://pokeapi.co/api/v2";
export const POKEMON_WIKI = "https://bulbapedia.bulbagarden.net";
export const POKEMON_ARCHIVE = "https://archives.bulbagarden.net";
export function pokemonWikiUrl(host: string, args: Record<string, string>) {
  // MediaWiki needs origin=* for web CORS. Bulbagarden's edge rejects a bare
  // wildcard in this query; percent-encode it without changing its API value.
  const query = new URLSearchParams({ ...args, format: "json", origin: "*" }).toString().replaceAll("*", "%2A");
  return `${host}/w/api.php?${query}`;
}
const MAX_BYTES = 3_000_000, TTL = 86_400_000;
type BoundedFetch = (url: string, init: RequestInit, timeoutMs: number, maxBytes: number) => Promise<Response>;

function waitForSource(signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 750);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Pokémon source returned no data");
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  const aborted = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", aborted, { once: true });
  try {
    signal.throwIfAborted();
    if (Number(response.headers.get("content-length")) > MAX_BYTES) throw Error("Pokémon source too large");
    for (;;) {
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw Error("Pokémon source too large");
      text += decoder.decode(part.value, { stream: true });
    }
    const data = JSON.parse(text + decoder.decode());
    // MediaWiki returns missing pages and temporary API failures with HTTP 200.
    // Reject them before caching so Retry makes a fresh request.
    if (data?.error?.code === "missingtitle") throw new GuideSourceNotFound();
    if (!data || typeof data !== "object" || data.error) throw Error("Pokémon source unavailable");
    return data;
  } finally {
    signal.removeEventListener("abort", aborted);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createPokemonSource(fetchBytes: BoundedFetch, now = Date.now) {
  const cooldown = new Map<string, number>();
  const request = async (url: string, signal: AbortSignal) => {
    const host = new URL(url).origin;
    if (now() < (cooldown.get(host) ?? 0)) throw Error("Pokémon data cooling down");
    const headers = new Headers({ Accept: "application/json" });
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)
      headers.set("User-Agent", `Harbor/${APP_VERSION} (+https://harbor.site)`);
    // Opening a game or chapter must never launch the interactive CF solver.
    // The bounded byte bridge returns provider failures inline and preserves JSON.
    const init = { signal, credentials: "omit" as const, headers };
    let response = await fetchBytes(url, init, 15_000, MAX_BYTES);
    // The wiki edge sometimes challenges the first cold read, then serves the
    // identical public request. One delayed, cancellable retry stays within the
    // shared 15s budget; persistent challenges still use the inline Retry state.
    if (host === POKEMON_WIKI && [403, 503].includes(response.status) && response.headers.get("cf-mitigated") === "challenge") {
      await response.body?.cancel().catch(() => {});
      await waitForSource(signal);
      response = await fetchBytes(url, init, 15_000, MAX_BYTES);
    }
    if (response.status === 429) cooldown.set(host, now() + 60_000);
    if (!response.ok) { void response.body?.cancel().catch(() => {}); throw Error(`Pokémon source ${response.status}`); }
    const data = await readJson(response, signal);
    if (host === POKEMON_WIKI && new URL(url).searchParams.get("action") === "parse") {
      const page = (data as { parse?: { title?: unknown; text?: { "*"?: unknown } } }).parse;
      if (typeof page?.title !== "string" || typeof page.text?.["*"] !== "string" || !page.text["*"].trim()) throw Error("Walkthrough unavailable");
    }
    return data;
  };
  const requests = new CompanionRequests(request, now);
  return async (url: string, signal: AbortSignal) => {
    const parsed = new URL(url);
    if (![new URL(POKEMON_API).origin, POKEMON_WIKI, POKEMON_ARCHIVE].includes(parsed.origin)
      || parsed.username || parsed.password) throw Error("Invalid Pokémon source");
    return (await requests.get(url, TTL, value => value, signal)).data;
  };
}
