import type { AudienceGame } from "./audience-charts";
import { launcherTitleLogo } from "./launcher-title-art";

export const XBOX_AUDIENCE_URL = "https://www.xbox.com/en-US/games/browse/Popular";
export const XBOX_AUDIENCE_API = "https://emerald.xboxservices.com/xboxcomfd/browse?locale=en-US";
export const XBOX_AUDIENCE_CHANNEL = "BROWSE_CHANNELID=POPULAR_FILTERS=";
export const XBOX_AUDIENCE_TTL = 15 * 60_000;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit = 300) => typeof value === "string" ? value.trim().slice(0, limit) : "";

function artwork(value: unknown, width: number): string | undefined {
  try {
    const url = new URL(text(record(value).url, 2000));
    if (url.protocol !== "https:" || !["store-images.s-microsoft.com", "store-images.microsoft.com"].includes(url.hostname)) return;
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", "85");
    return url.href;
  } catch { return; }
}

/** Microsoft's public most-played channel, in provider order. Never infer counts or other platforms. */
export function parseXboxAudience(raw: unknown): AudienceGame[] {
  const body = record(raw), channel = record(record(body.channels)[XBOX_AUDIENCE_CHANNEL]);
  if (!Array.isArray(channel.products) || !Array.isArray(body.productSummaries)) throw new Error("Invalid Xbox player chart");
  const summaries = new Map(body.productSummaries.map(value => { const row = record(value); return [row.productId, row] as const; }));
  const seen = new Set<string>();
  const games: AudienceGame[] = [];
  for (const [index, item] of channel.products.slice(0, 50).entries()) {
    const id = text(record(item).productId), row = summaries.get(id), name = text(row?.title);
    if (!/^[A-Z0-9]{12}$/.test(id) || !row || !name || seen.has(id) || row.productKind !== "Game") continue;
    seen.add(id);
    const images = record(row.images);
    const hero = artwork(images.superHeroArt, 1280);
    const capsule = artwork(images.superHeroArt, 480) || artwork(images.boxArt, 480) || artwork(images.poster, 480);
    if (!capsule) continue;
    // Stable product identities only supply original marks, never positions or edition guesses.
    const logoId = ({ BT5P2X999VH2: 1905, BQ1TN1T79V9K: 17269, "9MVXMVT8ZKWC": 135400 } as Record<string, number>)[id];
    games.push({ id: `xbox:${id}`, name: name.replace(/[™®]/g, "").trim(), capsule, hero,
      logo: launcherTitleLogo(logoId), description: text(row.shortDescription, 1500),
      platforms: ["Xbox"], chartRank: index + 1, sourceUrl: `https://www.xbox.com/en-US/games/store/-/${id}` });
  }
  if (!games.length) throw new Error("Xbox player chart is empty");
  return games;
}

/** The endpoint requires a fresh correlation vector; it is not an account identifier. */
export function xboxAudienceRequest(): RequestInit {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return { method: "POST", headers: { "content-type": "application/json", "X-MS-API-Version": "1.1",
    "MS-CV": `${btoa(String.fromCharCode(...bytes))}.0` },
    body: JSON.stringify({ ReturnFilters: false, ChannelKeyToBeUsedInResponse: XBOX_AUDIENCE_CHANNEL, ChannelId: "POPULAR" }) };
}
