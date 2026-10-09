import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { HELLDIVERS_API, HELLDIVERS_TTL, parseHelldiversCampaigns, parseHelldiversGalaxy, parseHelldiversOrders } from "./helldivers-data";

const MAX_BYTES = 2 * 1024 * 1024;
let nextRequest = 0, cooldown = 0;
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < cooldown) throw Error("Galactic War provider is rate limiting requests");
  // The public API permits five requests per ten seconds. Refresh and both
  // resources share this reservation, including overlapping detail readers.
  // Reserve only when starting a request. An abandoned page must not leave
  // unused reservations that delay the next visitor's observations.
  while (Date.now() < nextRequest) await wait(nextRequest - Date.now(), signal);
  signal.throwIfAborted();
  if (Date.now() < cooldown) throw Error("Galactic War provider is rate limiting requests");
  nextRequest = Date.now() + 2600;
  const response = await safeFetchBytes(url, { signal, credentials: "omit", headers: {
    "X-Super-Client": "HarborGameCompanions", "X-Super-Contact": "https://github.com/harborstremio/harbor/issues", "Accept-Language": "en-US",
  } }, 15_000, MAX_BYTES);
  if (response.status === 429) cooldown = retryAfterTime(response.headers.get("retry-after"), Date.now());
  if (!response.ok) throw Error(`Galactic War provider ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > MAX_BYTES) throw Error("Galactic War response too large"); text += decoder.decode(chunk.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Galactic War response too large"); }
  return JSON.parse(text) as unknown;
});
export function loadHelldiversCampaigns(signal: AbortSignal, refresh = false) { return requests.get(`${HELLDIVERS_API}/campaigns`, refresh ? 0 : HELLDIVERS_TTL, parseHelldiversCampaigns, signal); }
export function loadHelldiversOrders(signal: AbortSignal, refresh = false) { return requests.get(`${HELLDIVERS_API}/assignments`, refresh ? 0 : HELLDIVERS_TTL, parseHelldiversOrders, signal); }
export function loadHelldiversGalaxy(signal: AbortSignal, refresh = false) { return requests.get(`${HELLDIVERS_API}/planets`, refresh ? 0 : 5 * HELLDIVERS_TTL, parseHelldiversGalaxy, signal); }
