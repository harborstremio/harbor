import { readGuideSource } from "./guides-fetch";
import { parseGuideVideoPage, type GuideVideoCursor } from "./guides-data";
import { guideVideoFilter } from "./guide-video-options";
import { parseWarhammerFeed, warhammerTvUrl, type WarhammerSetting } from "./warhammer-universe-data";

export function loadWarhammerFeed(kind: "animations" | WarhammerSetting, signal: AbortSignal) {
  return readGuideSource(warhammerTvUrl(kind), signal, body => parseWarhammerFeed(JSON.parse(body), kind), 30 * 60_000);
}
export function loadWarhammerVideos(query: string, signal: AbortSignal, cursor?: GuideVideoCursor) {
  if (cursor) return readGuideSource("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", signal, body => parseGuideVideoPage(JSON.parse(body), "Warhammer", false, cursor.clientVersion), 600_000, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: cursor.clientVersion, hl: "en" } }, continuation: cursor.token }) });
  const params = new URLSearchParams({ search_query: `Warhammer ${query.trim().slice(0, 100) || "40k lore explained"}`, hl: "en", sp: guideVideoFilter("relevance", "all", false) });
  return readGuideSource(`https://www.youtube.com/results?${params}`, signal, body => parseGuideVideoPage(body, "Warhammer", false));
}
