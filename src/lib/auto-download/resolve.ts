import type { Addon } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import type { EpisodeHint } from "@/lib/streams/episode-file";
import { runPipeline } from "@/lib/streams/pipeline";
import { resolveStream } from "@/lib/streams/resolve";
import { buildStreamIdsWithIdentity } from "@/lib/streams/anime-identity";
import type { Resolution, ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { readSettings } from "./context";

export type DownloadPick = { url: string; headers?: Record<string, string>; label: string };

export type ResolveOptions = {
  allowP2p: boolean;
  maxHeight: number | null;
  imdbId: string | null;
  debrids: DebridStore[];
  addons: Addon[];
  signal: AbortSignal;
};

const HEIGHT: Record<Resolution, number> = {
  "4K": 2160,
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
  SD: 480,
};

const MIN_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CACHED_TRIES = 8;
const MAX_P2P_TRIES = 4;

function passesMaxHeight(s: ScoredStream, maxHeight: number | null): boolean {
  if (maxHeight == null) return true;
  const h = HEIGHT[s.resolution];
  if (h == null) return false;
  return h <= maxHeight;
}

function isStub(s: ScoredStream): boolean {
  const filename = s.behaviorHints?.filename ?? s.behaviorHints?.fileName ?? "";
  if (/\bsample\b/i.test(filename)) return true;
  if (s.size != null && s.size < MIN_FILE_BYTES) return true;
  return false;
}

function isCached(s: ScoredStream, debrids: DebridStore[]): boolean {
  return debrids.some((d) => s.cached[d.slug] === true || s.inLibrary[d.slug] === true);
}

function labelFor(s: ScoredStream): string {
  const parts = [s.resolution, s.hdrFormat, s.source !== "Other" ? s.source : null].filter(Boolean);
  const quality = parts.join(" ").trim();
  return quality ? `${quality} · ${s.addonName}` : s.addonName;
}

export async function resolveBestDownload(
  meta: Meta,
  episode: PlayEpisode | undefined,
  opts: ResolveOptions,
): Promise<DownloadPick | null> {
  const imdbId = meta.id.startsWith("tt") ? meta.id : opts.imdbId;
  const streamIds = await buildStreamIdsWithIdentity(meta.id, episode, imdbId);
  if (streamIds.length === 0) return null;

  const input = buildEpisodePipelineInput({
    meta,
    episode,
    imdbId,
    streamIds,
    addons: opts.addons,
    debrids: opts.debrids,
    settings: readSettings(),
    strictMode: false,
    filterDisabled: false,
  });

  const result = await runPipeline(input, opts.signal);
  if (opts.signal.aborted) return null;
  const hint: EpisodeHint = { season: episode?.season ?? null, episode: episode?.episode ?? null };
  const candidates = result.picker.all
    .filter((s) => passesMaxHeight(s, opts.maxHeight) && !isStub(s))
    .sort((a, b) => b.score - a.score);

  const cached = candidates.filter((s) => isCached(s, opts.debrids)).slice(0, MAX_CACHED_TRIES);
  for (const pick of cached) {
    if (opts.signal.aborted) return null;
    const r = await resolveStream(
      pick,
      opts.debrids,
      opts.signal,
      false,
      false,
      hint,
      false,
      false,
    );
    if (r.ok && r.data.url)
      return { url: r.data.url, headers: r.data.headers, label: labelFor(pick) };
  }

  if (!opts.allowP2p) return null;

  const p2p = candidates
    .filter((s) => Boolean(s.infoHash) && !isCached(s, opts.debrids))
    .slice(0, MAX_P2P_TRIES);
  for (const pick of p2p) {
    if (opts.signal.aborted) return null;
    const r = await resolveStream(pick, opts.debrids, opts.signal, true, false, hint, true, false);
    if (r.ok && r.data.url)
      return { url: r.data.url, headers: r.data.headers, label: labelFor(pick) };
  }
  return null;
}
