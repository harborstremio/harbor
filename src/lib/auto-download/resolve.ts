import type { Addon } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import type { EpisodeHint } from "@/lib/streams/episode-file";
import { episodeVariantMatch } from "@/lib/streams/episode-file";
import { parseStream } from "@/lib/streams/parser";
import { runPipeline } from "@/lib/streams/pipeline";
import { resolveStream } from "@/lib/streams/resolve";
import { buildStreamIdsWithIdentity } from "@/lib/streams/anime-identity";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { animeTitlesForMeta, isSafeAnimeAutoDownload } from "./anime-title-match";
import { readSettings } from "./context";
import { prepareDownloadSourceCandidates } from "./source-policy";

export type DownloadPick = {
  url: string;
  headers?: Record<string, string>;
  label: string;
  sourceFilename?: string;
};

export type ResolveOptions = {
  allowP2p: boolean;
  maxHeight: number | null;
  imdbId: string | null;
  debrids: DebridStore[];
  addons: Addon[];
  signal: AbortSignal;
  /** Optional aliases already loaded by a caller. Omit to load aliases for the exact Kitsu entry. */
  animeTitles?: string[] | null;
};

const MAX_CACHED_TRIES = 8;
const MAX_P2P_TRIES = 4;

function labelFor(s: ScoredStream): string {
  const parts = [s.resolution, s.hdrFormat, s.source !== "Other" ? s.source : null].filter(Boolean);
  const quality = parts.join(" ").trim();
  return quality ? `${quality} · ${s.addonName}` : s.addonName;
}

function isAnimeRequest(streamIds: string[]): boolean {
  return streamIds.some((id) => id.startsWith("kitsu:") || id.startsWith("mal:"));
}

async function pipelineCandidates(
  meta: Meta,
  episode: PlayEpisode | undefined,
  opts: ResolveOptions,
): Promise<{
  candidates: ScoredStream[];
  ready: ScoredStream[];
  p2p: ScoredStream[];
  anime: boolean;
  animeTitles: string[] | null;
}> {
  const imdbId = episode?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : opts.imdbId);
  const streamIds = await buildStreamIdsWithIdentity(meta.id, episode, imdbId);
  if (streamIds.length === 0 || opts.signal.aborted)
    return { candidates: [], ready: [], p2p: [], anime: false, animeTitles: null };

  const anime = isAnimeRequest(streamIds);
  const animeTitles = anime
    ? (opts.animeTitles ?? (await animeTitlesForMeta(meta, episode, streamIds)))
    : null;
  const settings = readSettings();
  const input = buildEpisodePipelineInput({
    meta,
    episode,
    imdbId,
    streamIds,
    addons: opts.addons,
    debrids: opts.debrids,
    settings,
    strictMode: settings.streamFilterLevel === "strict",
    filterDisabled: settings.streamFilterLevel === "off",
    animeTitles,
  });

  const result = await runPipeline(input, opts.signal);
  if (opts.signal.aborted) return { candidates: [], ready: [], p2p: [], anime, animeTitles };
  const { ready, p2p } = prepareDownloadSourceCandidates(result.picker.all, {
    maxHeight: opts.maxHeight,
    streamMode: settings.streamMode,
    debrids: opts.debrids,
    allowP2p: opts.allowP2p,
  });
  const eligible = new Set([...ready, ...p2p]);
  const candidates = result.picker.all.filter((stream) => eligible.has(stream));
  return {
    candidates,
    ready,
    p2p,
    anime,
    animeTitles,
  };
}

/** Discovers ranked download choices. This only fetches and filters streams. */
export async function findDownloadSources(
  meta: Meta,
  episode: PlayEpisode | undefined,
  opts: ResolveOptions,
): Promise<ScoredStream[]> {
  return (await pipelineCandidates(meta, episode, opts)).candidates;
}

function explicitEpisodeTag(filename: string): boolean {
  return /(?:^|[^a-z0-9])(?:s\s*\d{1,3}\s*e\s*\d{1,4}|\d{1,3}\s*x\s*\d{1,4}|season\s*\d{1,3}\s*(?:episode|ep|e)\s*\d{1,4})(?!\d)/i.test(
    filename,
  );
}

function conflictsWithRequestedEpisode(
  filename: string,
  hint: EpisodeHint,
  episode: PlayEpisode | undefined,
  streamIds: string[],
): boolean {
  if (!episode) return false;
  if (!explicitEpisodeTag(filename)) return false;
  const accepted: Array<[number | null | undefined, number | null | undefined]> = [
    [hint.season, hint.episode],
    [episode?.season, episode?.episode],
  ];
  for (const id of streamIds) {
    const nativeEpisode = /^(?:kitsu|mal):\d+:(\d+)$/.exec(id);
    if (nativeEpisode) accepted.push([1, Number(nativeEpisode[1])]);
  }
  return !accepted.some(
    ([season, number]) =>
      season != null && number != null && episodeVariantMatch(filename, season, number),
  );
}

/** Resolves the exact candidate selected by the user. It never tries another source. */
export async function resolveDownloadSource(
  meta: Meta,
  episode: PlayEpisode | undefined,
  stream: ScoredStream,
  opts: ResolveOptions,
): Promise<DownloadPick | null> {
  if (opts.signal.aborted) return null;
  const settings = readSettings();
  const { ready, p2p } = prepareDownloadSourceCandidates([stream], {
    maxHeight: opts.maxHeight,
    streamMode: settings.streamMode,
    debrids: opts.debrids,
    allowP2p: opts.allowP2p,
  });
  const p2pSource = p2p.includes(stream);
  if (!p2pSource && !ready.includes(stream)) return null;
  const imdbId = episode?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : opts.imdbId);
  const streamIds = await buildStreamIdsWithIdentity(meta.id, episode, imdbId);
  if (opts.signal.aborted) return null;

  const hint: EpisodeHint = {
    season: episode?.imdbSeason ?? episode?.season ?? null,
    episode: episode?.imdbEpisode ?? episode?.episode ?? null,
  };
  const resolved = await resolveStream(
    stream,
    opts.debrids,
    opts.signal,
    p2pSource,
    false,
    hint,
    p2pSource,
    false,
  ).catch(() => null);
  if (!resolved?.ok || !resolved.data.url || opts.signal.aborted) return null;

  const filename =
    resolved.data.filename ?? stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName;
  if (filename && conflictsWithRequestedEpisode(filename, hint, episode, streamIds)) {
    return null;
  }
  return {
    url: resolved.data.url,
    headers: resolved.data.headers,
    label: labelFor(stream),
    sourceFilename: filename ?? undefined,
  };
}

/** Resolves the highest-ranked confidently matched candidate for unattended downloads. */
export async function resolveBestDownload(
  meta: Meta,
  episode: PlayEpisode | undefined,
  opts: ResolveOptions,
): Promise<DownloadPick | null> {
  const { ready, p2p, anime, animeTitles } = await pipelineCandidates(meta, episode, opts);
  if (!anime) {
    // Non-anime requests retain the existing ranked fallback sequence.
    for (const stream of ready.slice(0, MAX_CACHED_TRIES)) {
      if (opts.signal.aborted) return null;
      const pick = await resolveDownloadSource(meta, episode, stream, opts);
      if (pick) return pick;
    }
    for (const stream of p2p.slice(0, MAX_P2P_TRIES)) {
      if (opts.signal.aborted) return null;
      const pick = await resolveDownloadSource(meta, episode, stream, opts);
      if (pick) return pick;
    }
    return null;
  }
  if (!animeTitles?.length) return null;

  const confident = (streams: ScoredStream[]) =>
    streams.filter((stream) => isSafeAnimeAutoDownload(animeTitles, stream.parsedTitle));
  for (const stream of confident(ready).slice(0, MAX_CACHED_TRIES)) {
    if (opts.signal.aborted) return null;
    const pick = await resolveDownloadSource(meta, episode, stream, opts);
    if (!pick) continue;
    if (
      pick.sourceFilename &&
      !isSafeAnimeAutoDownload(
        animeTitles,
        stream.parsedTitle,
        parseStream({
          ...stream,
          behaviorHints: { ...stream.behaviorHints, filename: pick.sourceFilename },
        }).parsedTitle,
      )
    ) {
      continue;
    }
    return pick;
  }
  for (const stream of confident(p2p).slice(0, MAX_P2P_TRIES)) {
    if (opts.signal.aborted) return null;
    const pick = await resolveDownloadSource(meta, episode, stream, opts);
    if (!pick) continue;
    if (
      pick.sourceFilename &&
      !isSafeAnimeAutoDownload(
        animeTitles,
        stream.parsedTitle,
        parseStream({
          ...stream,
          behaviorHints: { ...stream.behaviorHints, filename: pick.sourceFilename },
        }).parsedTitle,
      )
    ) {
      continue;
    }
    return pick;
  }
  return null;
}
