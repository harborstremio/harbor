import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, PlayerSnapshot, TrackInfo } from "@/lib/player/bridge";
import { fetchAndParse, parseSubtitle, type SubCue } from "./parser";

export type CueSource = { cues: SubCue[]; format: "srt" | "vtt" };
export type AnySourceResult = { ok: true; source: CueSource } | { ok: false; reason: string };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function resolveReadableUrl(url: string): Promise<string | null> {
  if (/^(https?|blob|data|tauri|asset):/i.test(url)) return url;
  if (isTauri()) {
    try {
      return convertFileSrc(url);
    } catch {
      return null;
    }
  }
  return null;
}

export function detectFormatFromUrl(url: string): "srt" | "vtt" {
  const ext = url.split(/[?#]/)[0].match(/\.([a-z]{2,4})$/i)?.[1]?.toLowerCase();
  return ext === "vtt" ? "vtt" : "srt";
}

function snapshotOf(bridge: PlayerBridge): PlayerSnapshot | null {
  let snap: PlayerSnapshot | null = null;
  const unsub = bridge.subscribe((s) => {
    snap = s;
  });
  unsub();
  return snap;
}

export function embeddedSubIndex(tracks: TrackInfo[], trackId: string): number {
  const idx = tracks.filter((t) => !t.external && !t.url).findIndex((t) => t.id === trackId);
  return idx >= 0 ? idx : 0;
}

function selectedEmbeddedIndex(bridge: PlayerBridge): number {
  const snap = snapshotOf(bridge);
  if (!snap) return 0;
  const sel = snap.subtitleTracks.find((t) => !t.external && !t.url && t.selected);
  return sel ? embeddedSubIndex(snap.subtitleTracks, sel.id) : 0;
}

export async function getCuesAnySource(
  bridge: PlayerBridge,
  sourceUrl: string | null,
  headers?: Record<string, string>,
): Promise<AnySourceResult> {
  const loaded = bridge.getSelectedTrackCues();
  if (loaded && loaded.length > 0) return { ok: true, source: { cues: loaded, format: "srt" } };

  const rawUrl = bridge.getSelectedTrackUrl();
  if (rawUrl) {
    const readable = await resolveReadableUrl(rawUrl);
    if (readable) {
      try {
        const cues = await fetchAndParse(readable);
        if (cues.length > 0) return { ok: true, source: { cues, format: detectFormatFromUrl(rawUrl) } };
      } catch {
        /* fall through to embedded extraction */
      }
    }
  }

  if (sourceUrl && isTauri()) {
    const streamIndex = selectedEmbeddedIndex(bridge);
    try {
      const srt = await invoke<string>("subtitle_extract", {
        source: sourceUrl,
        streamIndex,
        headers: headers ?? null,
      });
      const cues = parseSubtitle(srt, "srt");
      if (cues.length > 0) return { ok: true, source: { cues, format: "srt" } };
      return { ok: false, reason: "extract-empty" };
    } catch (e) {
      return { ok: false, reason: `extract-failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return { ok: false, reason: "no-cues" };
}
