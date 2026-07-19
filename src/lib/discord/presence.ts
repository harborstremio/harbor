const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const HARBOR_LOGO = "https://harbor.site/discord/harbordiscord.png";

type DiscordConfig = {
  enabled: boolean;
  hideTitle: boolean;
  showWhenPaused: boolean;
  showWhenBrowsing: boolean;
  showPoster: boolean;
  showTimestamp: boolean;
  showPartyJoin: boolean;
};

export type PlaybackPresence = {
  title: string;
  subtitle?: string;
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
};
let playback: PlaybackPresence | null = null;
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
  if (browse && config.showWhenBrowsing) {
    if (config.hideTitle)
      return {
        payload: { details: "Browsing Harbor", posterUrl: HARBOR_LOGO },
        key: "browse:hide",
      };
    return {
      payload: {
        details: browse.details ?? "Browsing Harbor",
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
    if (context && context.startsWith("Browsing Harbor")) context = undefined;
    if (context && playback && !config.hideTitle) {
      const sub = payload.state as string | undefined;
      if (sub) context = `${context} · ${sub}`;
    }
    const people = headcount === 1 ? "1 👤" : `${headcount} 👥`;
    payload.details = `Watch Party · ${people}`;
    payload.state = context ?? "In the lobby";
    if (party.joinUrl && config.showPartyJoin) {
      payload.buttonLabel = "Join the Watch Party";
      payload.buttonUrl = party.joinUrl;
    }
    const live = typeof payload.startTs === "number";
    return {
      payload,
      key: `party:${party.id}:${headcount}:${context ?? ""}:${party.joinUrl ?? ""}:${live ? "live" : "x"}`,
    };
  }
  if (!base) return { payload: null, key: "clear" };
  return base;
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

export function setPlaybackPresence(p: PlaybackPresence | null): void {
  playback = p;
  schedule();
}

export function setBrowsePresence(b: BrowsePresence | null): void {
  browse = b;
  schedule();
}

export function setPartyPresence(p: PartyPresence | null): void {
  party = p;
  schedule();
}
