import { getCurrentWindow } from "@tauri-apps/api/window";

const APP = "Harbor";
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let applied = "";

export function setMusicWindowTitle(title: string | null, artist: string | null): void {
  if (!IS_TAURI) return;
  const named = [title, artist].map((part) => part?.trim()).filter(Boolean) as string[];
  const next = named.length ? named.join(" · ") : APP;
  if (next === applied) return;
  applied = next;
  void getCurrentWindow()
    .setTitle(next)
    .catch(() => {
      applied = "";
    });
}
