import { invoke } from "@tauri-apps/api/core";
import { t } from "@/lib/i18n";

export type SongResult = {
  title: string;
  artist: string;
  album: string;
  artwork: string;
  link: string;
} | null;

export type SongIdToastMsg = {
  kind: "info" | "result" | "error";
  title: string;
  body?: string;
  art?: string;
  href?: string;
};

const TOAST_EVENT = "harbor:song-id-toast";

function toast(msg: SongIdToastMsg): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: msg }));
}

export function onSongIdToast(cb: (msg: SongIdToastMsg) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<SongIdToastMsg>).detail);
  window.addEventListener(TOAST_EVENT, h);
  return () => window.removeEventListener(TOAST_EVENT, h);
}

function youtubeSearchUrl(artist: string, title: string): string {
  const q = [artist, title].filter(Boolean).join(" ").trim();
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
}

let busy = false;

export function isIdentifying(): boolean {
  return busy;
}

export type SongIdOptions = {
  provider: "audd" | "ai";
  auddKey: string;
  aiKey: string;
  aiModel: string;
};

function showResult(res: SongResult): void {
  const head = res ? res.title || res.artist : "";
  if (!res || !head) {
    toast({ kind: "error", title: t("Couldn't identify the song") });
    return;
  }
  const sub = res.title ? [res.artist, res.album].filter(Boolean).join(" · ") : res.album;
  toast({
    kind: "result",
    title: head,
    body: sub || undefined,
    art: res.artwork || undefined,
    href: youtubeSearchUrl(res.artist, res.title),
  });
}

export async function identifyNowPlaying(opts: SongIdOptions): Promise<void> {
  if (busy) return;
  const useAi = opts.provider === "ai";
  const key = ((useAi ? opts.aiKey : opts.auddKey) ?? "").trim();
  if (!key) {
    toast({
      kind: "error",
      title: useAi ? t("Missing Gemini API key") : t("Missing AudD key"),
      body: t("Add it in Settings → Library & metadata"),
    });
    return;
  }
  busy = true;
  toast({ kind: "info", title: t("Listening…") });
  try {
    const res = useAi
      ? await invoke<SongResult>("recognize_now_playing_ai", {
          apiKey: key,
          model: (opts.aiModel ?? "").trim() || null,
          seconds: 8,
        })
      : await invoke<SongResult>("recognize_now_playing", { apiToken: key, seconds: 7 });
    showResult(res);
  } catch (e) {
    console.error("song-id failed", e);
    const detail = typeof e === "string" ? e : ((e as Error)?.message ?? String(e));
    toast({
      kind: "error",
      title: t("Song identification failed"),
      body: detail.trim().slice(0, 260) || undefined,
    });
  } finally {
    busy = false;
  }
}
