import { safeFetch } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { parseXboxAudience, xboxAudienceRequest, XBOX_AUDIENCE_API, XBOX_AUDIENCE_TTL } from "./xbox-audience";
import { matchXboxGames, xboxIdentityQuery } from "./xbox-audience-identity";
import { queryIgdb } from "./atlas";

const requests = new CompanionRequests(async (url, signal) => {
  const response = await safeFetch(url, { ...xboxAudienceRequest(), signal });
  if (!response.ok) throw new Error(`Xbox chart ${response.status}`);
  const body = await response.text();
  if (body.length > 4_000_000) throw new Error("Xbox chart is too large");
  return JSON.parse(body);
});

export async function loadXboxAudience(signal: AbortSignal) {
  const observation = await requests.get(XBOX_AUDIENCE_API, XBOX_AUDIENCE_TTL, parseXboxAudience, signal);
  const rows = await queryIgdb(xboxIdentityQuery(observation.data), signal).catch(() => []);
  signal.throwIfAborted();
  return { ...observation, data: matchXboxGames(observation.data, rows) };
}
