import { CompanionRequests } from "./companion-request";
import { wowAddonJson } from "./wow-addon-provider";
import { parseWowAddonMedia, wowAddonMediaUrl } from "./wow-addon-media-data";

const requests = new CompanionRequests((url, signal) => wowAddonJson(url, signal, 1024 * 1024));
export function loadWowAddonMedia(id: number, signal: AbortSignal) {
  return requests.get(wowAddonMediaUrl(id), 30 * 60_000, raw => parseWowAddonMedia(raw, id), signal);
}
