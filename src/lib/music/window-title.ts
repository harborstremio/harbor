import { getCurrentWindow } from "@tauri-apps/api/window";
import { PRODUCT_NAME } from "@/lib/i18n/brand";

const APP = PRODUCT_NAME;
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
