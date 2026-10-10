export type AudioProvider = "youtube" | "soundcloud" | "spotify";

export type ProfileAudio = {
  provider: AudioProvider;
  url: string;
  embedSrc: string;
  hidden: boolean;
};

export type AudioMeta = { title: string; thumbnail?: string; author?: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function ytId(u: URL): string | null {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return YT_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "music.youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = u.searchParams.get("v");
  if (v && YT_ID.test(v)) return v;
  const m = u.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function spotifyPath(u: URL): string | null {
  if (u.hostname.replace(/^www\./, "") !== "open.spotify.com") return null;
  const m = u.pathname.match(/\/(track|album|playlist|episode|artist)\/([A-Za-z0-9]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function parseClockToSec(v: string | null | undefined): number | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const mmss = s.match(/^(\d+):([0-5]?\d)$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const hms = s.match(/^(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (hms && (hms[1] || hms[2])) return parseInt(hms[1] || "0", 10) * 60 + parseInt(hms[2] || "0", 10);
  return null;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function audioTimes(raw: string): { startSec: number | null; endSec: number | null } {
  try {
    const u = new URL(raw.trim());
    return {
      startSec: parseClockToSec(u.searchParams.get("start") || u.searchParams.get("t")),
      endSec: parseClockToSec(u.searchParams.get("end")),
    };
  } catch {
    return { startSec: null, endSec: null };
  }
}

export function setAudioTimes(raw: string, startSec: number | null, endSec: number | null): string {
  try {
    const u = new URL(raw.trim());
    u.searchParams.delete("t");
    if (startSec && startSec > 0) u.searchParams.set("start", String(Math.round(startSec)));
    else u.searchParams.delete("start");
    if (endSec && endSec > 0) u.searchParams.set("end", String(Math.round(endSec)));
    else u.searchParams.delete("end");
    return u.toString();
  } catch {
    return raw;
  }
}

export function parseProfileAudio(
  raw: string,
  opts?: { autoplay?: boolean; muted?: boolean },
): ProfileAudio | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const autoplay = opts?.autoplay ?? false;
  const muted = opts?.muted === true;

  const yt = ytId(u);
  if (yt) {
    const p = new URLSearchParams({
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      iv_load_policy: "3",
      autoplay: autoplay ? "1" : "0",
      mute: muted ? "1" : "0",
    });
    const startSec = parseClockToSec(u.searchParams.get("start") || u.searchParams.get("t"));
    const endSec = parseClockToSec(u.searchParams.get("end"));
    if (startSec && startSec > 0) p.set("start", String(startSec));
    if (endSec && endSec > 0) p.set("end", String(endSec));
    return {
      provider: "youtube",
      url: `https://youtu.be/${yt}`,
      embedSrc: `https://www.youtube-nocookie.com/embed/${yt}?${p.toString()}`,
      hidden: true,
    };
  }

  const host = u.hostname.replace(/^www\./, "");
  if (host === "soundcloud.com" || host === "m.soundcloud.com") {
    const page = `https://soundcloud.com${u.pathname}`;
    const p = new URLSearchParams({
      url: page,
      auto_play: autoplay ? "true" : "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "false",
      show_teaser: "false",
      visual: "false",
    });
    return {
      provider: "soundcloud",
      url: page,
      embedSrc: `https://w.soundcloud.com/player/?${p.toString()}`,
      hidden: true,
    };
  }

  const sp = spotifyPath(u);
  if (sp) {
    return {
      provider: "spotify",
      url: `https://open.spotify.com/${sp}`,
      embedSrc: `https://open.spotify.com/embed/${sp}?theme=0`,
      hidden: false,
    };
  }

  return null;
}

const OEMBED: Record<AudioProvider, (url: string) => string> = {
  youtube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  soundcloud: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  spotify: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
};

const metaCache = new Map<string, AudioMeta | null>();

export async function fetchAudioMeta(a: ProfileAudio, signal?: AbortSignal): Promise<AudioMeta | null> {
  const hit = metaCache.get(a.url);
  if (hit !== undefined) return hit;
  try {
    const r = await fetch(OEMBED[a.provider](a.url), { signal });
    if (!r.ok) throw new Error("oembed");
    const d = (await r.json()) as { title?: string; thumbnail_url?: string; author_name?: string };
    const meta: AudioMeta = {
      title: String(d.title ?? "").slice(0, 160),
      thumbnail: typeof d.thumbnail_url === "string" && d.thumbnail_url.startsWith("https:") ? d.thumbnail_url : undefined,
      author: typeof d.author_name === "string" ? d.author_name.slice(0, 80) : undefined,
    };
    metaCache.set(a.url, meta);
    return meta;
  } catch {
    metaCache.set(a.url, null);
    return null;
  }
}

export function sendAudioVolume(
  frame: HTMLIFrameElement | null,
  provider: AudioProvider,
  volume: number,
): void {
  const win = frame?.contentWindow;
  if (!win) return;
  const v = Math.max(0, Math.min(100, Math.round(volume)));
  if (provider === "youtube") {
    win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [v] }), "*");
    return;
  }
  if (provider === "soundcloud") {
    win.postMessage(JSON.stringify({ method: "setVolume", value: v }), "*");
  }
}

type Cmd = "play" | "pause" | "mute" | "unmute";

export function sendAudioCommand(frame: HTMLIFrameElement | null, provider: AudioProvider, cmd: Cmd): void {
  const win = frame?.contentWindow;
  if (!win) return;
  if (provider === "youtube") {
    const func =
      cmd === "play" ? "playVideo" : cmd === "pause" ? "pauseVideo" : cmd === "mute" ? "mute" : "unMute";
    win.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
    return;
  }
  if (provider === "soundcloud") {
    const body =
      cmd === "play"
        ? { method: "play" }
        : cmd === "pause"
          ? { method: "pause" }
          : { method: "setVolume", value: cmd === "mute" ? 0 : 100 };
    win.postMessage(JSON.stringify(body), "*");
  }
}
