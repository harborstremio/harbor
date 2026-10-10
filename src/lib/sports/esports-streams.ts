export type EsportsStream = {
  title: string;
  url: string;
  platform: "twitch" | "youtube" | "kick" | "external";
};

/** Kick's documented standalone chat page, opened in a separate window. */
export function esportsChatPopoutUrl(stream: EsportsStream): string | null {
  if (stream.platform !== "kick" || !esportsEmbedUrl(stream, "localhost")) return null;
  const channel = new URL(stream.url).pathname.split("/").filter(Boolean)[0];
  return `https://kick.com/popout/${encodeURIComponent(channel)}/chat`;
}

export function officialBroadcastSource(stream: EsportsStream): import("../view").PlayerSrc | null {
  const url = esportsExternalUrl(stream.url);
  if (!url) return null;
  return {
    meta: { id: `iptv:official:${url}`, type: "tv", name: stream.title },
    url,
    title: stream.title,
    sportsDocked: true,
    isLive: stream.platform === "twitch" || stream.platform === "kick",
    officialBroadcast: { ...stream, url },
  };
}

/** Embed only recognized public players; never turn a provider URL into arbitrary HTML. */
export function esportsEmbedUrl(stream: EsportsStream, hostname: string): string | null {
  let url: URL;
  try {
    url = new URL(stream.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (stream.platform === "kick" && host === "kick.com") {
    const channel = url.pathname.match(/^\/([a-zA-Z0-9_-]{1,64})\/?$/)?.[1];
    return channel ? `https://player.kick.com/${channel}?autoplay=false` : null;
  }
  if (stream.platform === "twitch" && host === "twitch.tv") {
    const channel = url.pathname.match(/^\/([a-zA-Z0-9_]{1,25})\/?$/)?.[1];
    if (
      !channel ||
      ["directory", "search", "videos", "downloads", "settings", "login", "signup"].includes(
        channel.toLowerCase(),
      ) ||
      !/^[a-zA-Z0-9_]{1,25}$/.test(channel) ||
      !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(hostname)
    )
      return null;
    return `https://player.twitch.tv/?${new URLSearchParams({ channel, parent: hostname, autoplay: "false", muted: "false" })}`;
  }
  if (
    stream.platform === "youtube" &&
    ["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)
  ) {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1];
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`;
  }
  return null;
}

/**
 * How a validated stream can actually play. Twitch answers both its player and its chat
 * embed with `frame-ancestors https://<parent>`, and Harbor's packaged origin is
 * `http://tauri.localhost`, so an iframe is refused in every build that is not the dev
 * server on localhost. A top-level document is not constrained by that header, so Twitch
 * opens in its own webview. YouTube and Kick send no frame rule and stay inline.
 */
export type EsportsPlayback = { mode: "iframe" | "window"; url: string };

export function esportsPlayback(stream: EsportsStream, hostname: string): EsportsPlayback | null {
  // The embed allowlist stays the only gate, so a channel Harbor will not inline is also a
  // channel Harbor will not open in a window.
  const embed = esportsEmbedUrl(stream, hostname);
  if (!embed) return null;
  if (stream.platform !== "twitch") return { mode: "iframe", url: embed };
  const channel = new URL(embed).searchParams.get("channel");
  return channel
    ? { mode: "window", url: `https://www.twitch.tv/${encodeURIComponent(channel)}` }
    : null;
}

export function esportsExternalUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
