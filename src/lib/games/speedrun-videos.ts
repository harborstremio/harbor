export type SpeedrunVideo = { url: string; source: string; kind: "youtube" | "twitch" | "twitch-clip" | "external"; id: string; start: number };

function startTime(value: string | null): number {
  if (!value) return 0;
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  const seconds = /^\d+$/.test(value) ? Number(value) : parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : 0;
  return Number.isSafeInteger(seconds) && seconds <= 31_536_000 ? seconds : 0;
}

export function parseSpeedrunVideo(value: unknown): SpeedrunVideo | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, ""), path = url.pathname;
    const start = startTime(url.searchParams.get("t") || url.searchParams.get("start") || url.hash.match(/^#t=(.+)$/)?.[1] || null);
    let id = "";
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
      id = host === "youtu.be" ? path.slice(1) : path === "/watch" ? url.searchParams.get("v") || "" : path.match(/^\/(?:embed|live|shorts)\/([\w-]{11})\/?$/)?.[1] || "";
      if (!/^[\w-]{11}$/.test(id)) return null;
      return { url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`, source: "YouTube", kind: "youtube", id, start };
    }
    if (["twitch.tv", "m.twitch.tv"].includes(host)) {
      id = path.match(/^\/(?:videos|[^/]+\/v)\/(\d+)\/?$/)?.[1] || "";
      if (id) return { url: `https://www.twitch.tv/videos/${id}${start ? `?t=${start}s` : ""}`, source: "Twitch", kind: "twitch", id, start };
      id = path.match(/^\/[^/]+\/clip\/([\w-]+)\/?$/)?.[1] || "";
    } else if (host === "clips.twitch.tv") id = path.match(/^\/([\w-]+)\/?$/)?.[1] || "";
    if (id) return { url: `https://clips.twitch.tv/${id}`, source: "Twitch", kind: "twitch-clip", id, start: 0 };
    // Other video hosts stay links; provider data never becomes an arbitrary iframe.
    const sources: Record<string, string> = { "vimeo.com": "Vimeo", "nicovideo.jp": "Niconico", "nico.ms": "Niconico", "bilibili.com": "Bilibili", "b23.tv": "Bilibili", "archive.org": "Internet Archive", "medal.tv": "Medal", "hitbox.tv": "Hitbox" };
    if (!sources[host] || path === "/") return null;
    url.protocol = "https:";
    return { url: url.href, source: sources[host], kind: "external", id: "", start: 0 };
  } catch { return null; }
}

export function speedrunVideoEmbed(video: SpeedrunVideo, parent: string): string | null {
  if (video.kind === "youtube" && /^[\w-]{11}$/.test(video.id)) return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1&start=${video.start}`;
  if (!/^[a-z0-9.-]+$/i.test(parent)) return null;
  const query = new URLSearchParams({ parent, autoplay: "true" });
  if (video.kind === "twitch" && /^\d+$/.test(video.id)) { query.set("video", `v${video.id}`); query.set("time", `${video.start}s`); return `https://player.twitch.tv/?${query}`; }
  if (video.kind === "twitch-clip" && /^[\w-]+$/.test(video.id)) { query.set("clip", video.id); return `https://clips.twitch.tv/embed?${query}`; }
  return null;
}
