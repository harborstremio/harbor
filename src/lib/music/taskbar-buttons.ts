import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isMusicLiked } from "./liked";
import { setMusicWindowTitle } from "./window-title";
import { clearMediaControls, mediaKeyGate, updateMediaControls } from "@/lib/media-session";
import { videoOwnsMediaKeys } from "@/lib/player/media-key-owner";
import {
  getMusicState,
  nextMusic,
  previousMusic,
  seekMusic,
  setMusicVolume,
  subscribeMusic,
  toggleMusicLiked,
  toggleMusicPlayback,
} from "./player";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const EVENT = "harbor://taskbar-button";
const MEDIA_KEY_EVENT = "harbor://media-key";
const STEP_SECONDS = 30;

let muted = 0;
let lastPushed = "";
let lastArt = "";

function run(action: string): void {
  const state = getMusicState();
  if (!state.current) return;
  switch (action) {
    case "toggle":
      toggleMusicPlayback();
      return;
    case "next":
      nextMusic();
      return;
    case "previous":
      previousMusic();
      return;
    case "back":
      seekMusic(Math.max(0, state.currentTime - STEP_SECONDS));
      return;
    case "forward":
      seekMusic(Math.min(state.duration || Infinity, state.currentTime + STEP_SECONDS));
      return;
    case "like":
      toggleMusicLiked();
      return;
    case "mute":
      if (state.volume > 0) {
        muted = state.volume;
        setMusicVolume(0);
      } else {
        setMusicVolume(muted > 0 ? muted : 0.8);
      }
      return;
    default:
  }
}

function mediaKey(action: string): void {
  if (videoOwnsMediaKeys()) return;
  const state = getMusicState();
  if (!state.current || !mediaKeyGate()) return;
  const playing = state.phase === "playing";
  switch (action) {
    case "playpause":
      toggleMusicPlayback();
      return;
    case "play":
      if (!playing) toggleMusicPlayback();
      return;
    case "pause":
    case "stop":
      if (playing) toggleMusicPlayback();
      return;
    case "next":
      nextMusic();
      return;
    case "previous":
      previousMusic();
      return;
    default:
  }
}

/** Without this the OS never learns Harbor is playing music, so the media keys go elsewhere. */
function pushSession(): void {
  if (videoOwnsMediaKeys()) return;
  const state = getMusicState();
  const track = state.current;
  if (!track || state.phase === "idle" || state.phase === "error") {
    clearMediaControls();
    return;
  }
  const art = Array.isArray(track.artwork) ? track.artwork[0] : track.artwork;
  updateMediaControls(
    state.phase === "playing",
    track.title || "",
    track.artist || "",
    typeof art === "string" && art.startsWith("https://") ? art : null,
    state.duration || null,
    state.currentTime,
    state.volume,
  );
}

function push(): void {
  const state = getMusicState();
  const playing = state.phase === "playing";
  pushSession();
  const liked = isMusicLiked(state.likedIds, state.current);
  const silent = state.volume <= 0;
  setMusicWindowTitle(state.current?.title ?? null, state.current?.artist ?? null);
  pushArtwork(state.current?.artwork ?? null);
  const key = `${playing ? 1 : 0}|${liked ? 1 : 0}|${silent ? 1 : 0}`;
  if (key === lastPushed) return;
  lastPushed = key;
  invoke("media_controls_music_state", { playing, liked, muted: silent }).catch(() => {});
}

function appIconFollowsArtwork(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    return raw ? JSON.parse(raw).musicArtworkAppIcon === true : false;
  } catch {
    return false;
  }
}

async function restoreAppIcon(): Promise<void> {
  try {
    const raw = localStorage.getItem("harbor.settings");
    const chosen = raw ? (JSON.parse(raw).customAppIcon as string | undefined) : undefined;
    const { applyAppIcon } = await import("@/lib/app-icon");
    await applyAppIcon(chosen ?? "");
  } catch {}
}

function pushArtwork(artwork: string | null): void {
  const url = artwork?.startsWith("https://") ? artwork : null;
  const appIcon = appIconFollowsArtwork();
  const key = `${url ?? ""}|${appIcon ? 1 : 0}`;
  if (key === lastArt) return;
  lastArt = key;
  invoke("media_controls_music_art", { artUrl: url, appIcon }).catch(() => {});
  if (!url) void restoreAppIcon();
}

export function syncMusicTaskbarArtwork(): void {
  if (!IS_TAURI) return;
  lastArt = "";
  pushArtwork(getMusicState().current?.artwork ?? null);
}

export function startMusicTaskbarButtons(): () => void {
  if (!IS_TAURI) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  let stopKeys: (() => void) | null = null;
  void listen<string>(EVENT, (event) => run(event.payload))
    .then((unlisten) => {
      if (live) stop = unlisten;
      else unlisten();
    })
    .catch(() => {});
  void listen<string>(MEDIA_KEY_EVENT, (event) => mediaKey(event.payload))
    .then((unlisten) => {
      if (live) stopKeys = unlisten;
      else unlisten();
    })
    .catch(() => {});
  const unsubscribe = subscribeMusic(push);
  push();
  return () => {
    live = false;
    unsubscribe();
    setMusicWindowTitle(null, null);
    pushArtwork(null);
    if (!videoOwnsMediaKeys()) clearMediaControls();
    stop?.();
    stop = null;
    stopKeys?.();
    stopKeys = null;
  };
}
