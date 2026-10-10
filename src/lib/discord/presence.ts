import type { MangaReadingState } from "@/lib/manga-reading-state";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const HARBOR_LOGO = "https://jl-media-vision.vercel.app/favicon.png";
// Discord strips buttons that link to its own invites: discord.gg makes it
// reject the whole activity (presence vanishes), discord.com/invite is dropped
// silently. A community-invite button needs a redirect on a domain we own.
const STATIC_BUTTONS = [{ label: "JL Media Vision Website", url: "https://jl-media-vision.vercel.app/" }];

type DiscordConfig = {
  enabled: boolean;
  hideTitle: boolean;
  showWhenPaused: boolean;
  showWhenBrowsing: boolean;
  showPoster: boolean;
  showTimestamp: boolean;
  showPartyJoin: boolean;
  showMusic: boolean;
};

export type MusicPresence = {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  paused: boolean;
  positionSec: number;
  durationSec: number;
  trackUrl?: string;
  artistUrl?: string;
  albumUrl?: string;
};

export type PlaybackPresence = {
  title: string;
  subtitle?: string;
  metaId?: string;
  metaType?: string;
  posterUrl?: string;
  smallImageUrl?: string;
  year?: string | number;
  paused: boolean;
  positionSec: number;
  durationSec: number;
};

export type BrowsePresence = {
  details?: string;
  state?: string;
  largeImage?: string;
  largeText?: string;
};

export type PartyPresence = {
  id: string;
  size: number;
  joinUrl?: string;
};

let config: DiscordConfig = {
  enabled: false,
  hideTitle: false,
  showWhenPaused: true,
  showWhenBrowsing: true,
  showPoster: true,
  showTimestamp: true,
  showPartyJoin: true,
  showMusic: true,
};
let playback: PlaybackPresence | null = null;
let music: MusicPresence | null = null;
let reading: MangaReadingState = null;
let browse: BrowsePresence | null = null;
let party: PartyPresence | null = null;
let lastEnabledSent: boolean | null = null;
let lastKey = "";
let lastStartTs: number | null = null;
let flushTimer: number | null = null;

async function call(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!IS_TAURI) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(cmd, args);
  } catch {
    /* discord not running or disabled; harmless */
  }
}

type Computed = { payload: Record<string, unknown> | null; key: string };
type Base = { payload: Record<string, unknown>; key: string } | null;

function computeBase(): Base {
  if (playback && !(playback.paused && !config.showWhenPaused)) {
    if (config.hideTitle) {
      return {
        payload: {
          details: "Watching something",
          state: playback.paused ? "Paused" : undefined,
          posterUrl: HARBOR_LOGO,
          paused: playback.paused,
        },
        key: `hide:${playback.paused}`,
      };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const remaining = playback.durationSec - playback.positionSec;
    const live = !playback.paused && playback.durationSec > 0 && remaining > 0;
    const state = playback.paused
      ? "Paused"
      : playback.subtitle || (playback.year != null ? String(playback.year) : undefined);
    return {
      payload: {
        details: playback.title,
        state,
        posterUrl: (config.showPoster && playback.posterUrl) || HARBOR_LOGO,
        smallImageUrl: (config.showPoster && playback.smallImageUrl) || undefined,
        largeText: playback.year != null ? `${playback.title} (${playback.year})` : playback.title,
        startTs:
          live && config.showTimestamp ? nowSec - Math.floor(playback.positionSec) : undefined,
        endTs: live && config.showTimestamp ? nowSec + Math.floor(remaining) : undefined,
        paused: playback.paused,
      },
      key: `play:${playback.title}|${state ?? ""}|${playback.paused}|${playback.posterUrl ?? ""}|${live ? "ts" : "nots"}`,
    };
  }
  if (music && config.showMusic && !party && !(music.paused && !config.showWhenPaused)) {
    if (config.hideTitle) {
      return {
        payload: {
          details: "Listening to something",
          state: music.paused ? "Paused" : undefined,
          posterUrl: HARBOR_LOGO,
          activityType: "listening",
          paused: music.paused,
        },
        key: `music:hide:${music.paused}`,
      };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const remaining = music.durationSec - music.positionSec;
    const live = !music.paused && music.durationSec > 0 && remaining > 0;
    const credit = music.album ? `${music.artist} · ${music.album}` : music.artist;
    const state = music.paused ? `Paused · ${music.artist}` : credit;
    const buttons = music.trackUrl
      ? [{ label: "Listen in JL Media Vision", url: music.trackUrl }, ...STATIC_BUTTONS]
      : STATIC_BUTTONS;
    return {
      payload: {
        details: music.title,
        detailsUrl: music.trackUrl,
        state,
        stateUrl: music.artistUrl ?? music.trackUrl,
        posterUrl: (config.showPoster && music.artwork) || HARBOR_LOGO,
        largeText: music.album ? `${music.album} by ${music.artist}` : music.artist,
        largeUrl: music.albumUrl ?? music.trackUrl,
        smallUrl: STATIC_BUTTONS[0].url,
        startTs: live && config.showTimestamp ? nowSec - Math.floor(music.positionSec) : undefined,
        endTs: live && config.showTimestamp ? nowSec + Math.floor(remaining) : undefined,
        activityType: "listening",
        paused: music.paused,
        buttons,
      },
      key: `music:${music.title}|${state}|${music.artwork ?? ""}|${live ? "ts" : "nots"}`,
    };
  }
  if (reading) {
    if (config.hideTitle) {
      return {
        payload: {
          details: "Reading something",
          state: reading.page > 0 ? `Page ${reading.page}/${reading.totalPages}` : undefined,
          posterUrl: HARBOR_LOGO,
        },
        key: `read:hide:${reading.page}/${reading.totalPages}`,
      };
    }
    const state = `${reading.chapterLabel}, page ${reading.page}/${reading.totalPages}`;
    return {
      payload: {
        details: reading.title,
        state,
        posterUrl: (config.showPoster && reading.cover) || HARBOR_LOGO,
        largeText: reading.title,
      },
      key: `read:${reading.title}|${state}|${reading.cover ?? ""}`,
    };
  }
  if (browse && config.showWhenBrowsing) {
    if (config.hideTitle)
      return {
        payload: { details: "Browsing JL Media Vision", posterUrl: HARBOR_LOGO },
        key: "browse:hide",
      };
    return {
      payload: {
        details: browse.details ?? "Browsing JL Media Vision",
        state: browse.state,
        posterUrl: (config.showPoster && browse.largeImage) || HARBOR_LOGO,
        largeText: browse.largeText ?? browse.details,
      },
      key: `browse:${browse.details ?? ""}|${browse.state ?? ""}|${browse.largeImage ?? ""}`,
    };
  }
  if (party) {
    return { payload: { details: "In a Watch Party", posterUrl: HARBOR_LOGO }, key: "party-only" };
  }
  return null;
}

function compute(): Computed {
  const base = computeBase();
  if (party) {
    const headcount = Math.max(1, party.size);
    const payload: Record<string, unknown> = base ? { ...base.payload } : {};
    let context = base && !config.hideTitle ? (payload.details as string | undefined) : undefined;
    if (context && context.startsWith("Browsing JL Media Vision")) context = undefined;
    if (context && playback && !config.hideTitle) {
      const sub = payload.state as string | undefined;
      if (sub) context = `${context} · ${sub}`;
    }
    const people = headcount === 1 ? "1 👤" : `${headcount} 👥`;
    payload.details = `Watch Party · ${people}`;
    payload.state = context ?? "In the lobby";
    payload.buttons =
      party.joinUrl && config.showPartyJoin
        ? [{ label: "Join the Watch Party", url: party.joinUrl }, ...STATIC_BUTTONS]
        : STATIC_BUTTONS;
    const live = typeof payload.startTs === "number";
    return {
      payload,
      key: `party:${party.id}:${headcount}:${context ?? ""}:${party.joinUrl ?? ""}:${live ? "live" : "x"}`,
    };
  }
  if (!base) return { payload: null, key: "clear" };
  return { payload: { buttons: STATIC_BUTTONS, ...base.payload }, key: base.key };
}

function flush(): void {
  if (lastEnabledSent !== config.enabled) {
    lastEnabledSent = config.enabled;
    void call("discord_set_enabled", { on: config.enabled });
  }
  if (!config.enabled) {
    lastKey = "";
    lastStartTs = null;
    return;
  }
  const { payload, key } = compute();
  const startTs = payload && typeof payload.startTs === "number" ? payload.startTs : null;
  const seeked = startTs != null && lastStartTs != null && Math.abs(startTs - lastStartTs) > 4;
  if (key === lastKey && !seeked) return;
  lastKey = key;
  lastStartTs = startTs;
  if (payload) void call("discord_set_presence", { p: payload });
  else void call("discord_clear");
}

function schedule(): void {
  if (!IS_TAURI) return;
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush();
  }, 800);
}

export function configureDiscord(next: DiscordConfig): void {
  config = next;
  lastKey = "";
  schedule();
}

export type ActivityState = { playback: PlaybackPresence | null; party: PartyPresence | null };

const activitySubs = new Set<(s: ActivityState) => void>();

function emitActivity(): void {
  const s: ActivityState = { playback, party };
  for (const fn of activitySubs) fn(s);
}

export function subscribeActivity(fn: (s: ActivityState) => void): () => void {
  activitySubs.add(fn);
  fn({ playback, party });
  return () => {
    activitySubs.delete(fn);
  };
}

export function setPlaybackPresence(p: PlaybackPresence | null): void {
  playback = p;
  schedule();
  emitActivity();
}

export function setMusicPresence(m: MusicPresence | null): void {
  music = m;
  schedule();
}

export function setReadingPresence(r: MangaReadingState): void {
  reading = r;
  schedule();
}

export function setBrowsePresence(b: BrowsePresence | null): void {
  browse = b;
  schedule();
}

export function setPartyPresence(p: PartyPresence | null): void {
  party = p;
  schedule();
  emitActivity();
}
