import { requestEsportsText } from "./esports-feeds";
import { esportsExternalUrl, type EsportsStream } from "./esports-streams";

export function parseChannelAvatar(text: string): string | undefined {
  const patterns = [
    /"(?:profile_image_url|profileImageURL|profile_pic|profile_picture)"\s*:\s*"([^"<>]+)"/,
    /"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"<>]+)"/,
    /(?:content|href)=["'](https:\/\/[^"'<>]*profile[^"'<>]*)["']/i,
  ];
  for (const pattern of patterns) {
    const raw = text.match(pattern)?.[1];
    if (!raw) continue;
    try {
      const url = new URL(raw.replace(/\\\//g, "/").replace(/&amp;/g, "&"));
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch {
      /* Missing artwork uses the channel initial. */
    }
  }
}
export async function fetchChannelAvatar(stream: EsportsStream): Promise<string | undefined> {
  const url = esportsExternalUrl(stream.url);
  if (!url) return;
  const channel = new URL(url).pathname.split("/").filter(Boolean)[0];
  const source =
    stream.platform === "kick" && /^[a-zA-Z0-9_-]+$/.test(channel ?? "")
      ? `https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`
      : url;
  return parseChannelAvatar(await requestEsportsText(source, 60 * 60_000));
}
