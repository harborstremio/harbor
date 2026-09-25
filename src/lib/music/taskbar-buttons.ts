import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isMusicLiked } from "./liked";
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
const STEP_SECONDS = 30;

let muted = 0;
let lastPushed = "";

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

function push(): void {
  const state = getMusicState();
  const playing = state.phase === "playing";
  const liked = isMusicLiked(state.likedIds, state.current);
  const key = `${playing ? 1 : 0}|${liked ? 1 : 0}`;
  if (key === lastPushed) return;
  lastPushed = key;
  invoke("media_controls_music_state", { playing, liked }).catch(() => {});
}

export function startMusicTaskbarButtons(): () => void {
  if (!IS_TAURI) return () => {};
  let stop: (() => void) | null = null;
  let live = true;
  void listen<string>(EVENT, (event) => run(event.payload))
    .then((unlisten) => {
      if (live) stop = unlisten;
      else unlisten();
    })
    .catch(() => {});
  const unsubscribe = subscribeMusic(push);
  push();
  return () => {
    live = false;
    unsubscribe();
    stop?.();
    stop = null;
  };
}
