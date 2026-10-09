import { safeFetch } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { DECK_AUDIENCE_TTL, DECK_AUDIENCE_URL, parseDeckAudience } from "./deck-audience";

const requests = new CompanionRequests(async (url, signal) => {
  const response = await safeFetch(url, { signal });
  if (!response.ok) throw new Error(`Steam Deck chart ${response.status}`);
  return response.text();
});

export function loadDeckAudience(signal: AbortSignal) {
  return requests.get(DECK_AUDIENCE_URL, DECK_AUDIENCE_TTL, parseDeckAudience, signal);
}
