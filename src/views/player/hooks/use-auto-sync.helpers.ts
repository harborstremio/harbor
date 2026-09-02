import type { PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import type { SubCue } from "@/lib/subtitles/parser";
import type {
  MediaMeta,
  PipelineContext,
  PipelineOutcome,
  SourceKind,
} from "@/lib/subtitles/autosync/pipeline";
import { outcomeRank, type SubtitleFormat } from "@/lib/subtitles/autosync/fp-gate";
import type { DriftPlayerState } from "@/lib/subtitles/autosync/drift-monitor";
import { normalizeLang } from "@/lib/subtitles/language";

export function isLoopback(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(url);
}

export function outcomeScore(o: PipelineOutcome): number {
  const c = o.candidate;
  const ratioResolved = c && c.kind === "affine" && Math.abs(c.ratio - 1) > 1e-6 ? 1 : 0;
  return (
    outcomeRank(o.decision.decision) * 100 +
    ratioResolved * 10 +
    Math.round(o.decision.pCorrect * 9)
  );
}

export function subLanguages(trackLang: string | undefined, preferred: string[]): string[] {
  return [trackLang, ...preferred]
    .map((lang) => normalizeLang(lang))
    .filter((lang): lang is string => lang.length > 0)
    .filter((lang, index, all) => all.indexOf(lang) === index);
}

export function audioLanguageFromSnapshot(snap: PlayerSnapshot): string | null {
  const selected = snap.audioTracks.find((track) => track.selected) ?? null;
  if (selected) return normalizeLang(selected.lang ?? "") || null;
  const fallback = snap.audioTracks.find((track) => track.default) ?? null;
  const candidates = [fallback, snap.audioTracks.length === 1 ? snap.audioTracks[0] : null];
  for (const track of candidates) {
    const lang = normalizeLang(track?.lang ?? "");
    if (lang) return lang;
  }
  return null;
}

function parseMinutes(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v > 0 ? v : undefined;
  const m = /(\d+)/.exec(v);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildMeta(src: PlayerSrc): MediaMeta {
  const mins = src.episode?.runtime ?? parseMinutes(src.meta.runtime);
  return {
    imdbId: src.imdbId,
    season: src.episode?.season,
    episode: src.episode?.episode,
    isAnime: src.isAnime === true || src.meta.type === "anime",
    expectedRuntimeSec: mins ? mins * 60 : undefined,
  };
}

export function buildContext(
  src: PlayerSrc,
  snap: PlayerSnapshot,
  sourceKind: SourceKind,
  cues: SubCue[],
  subtitle: {
    language?: string | null;
    preferredLanguages: string[];
    format: SubtitleFormat;
  },
): PipelineContext {
  const subtitleLanguage = normalizeLang(subtitle.language ?? "") || null;
  const preferredSubtitleLanguages = subLanguages(undefined, subtitle.preferredLanguages);
  return {
    mediaUrl: src.url,
    headers: src.headers,
    infoHash: src.streamRef?.infoHash ?? null,
    sourceKind,
    durationSec: snap.durationSec,
    cues: cues.map((c) => [c.start, c.end] as [number, number]),
    cueText: cues.map((c) => c.text),
    moviebytesize: src.streamRef?.size ?? undefined,
    audioLanguage: audioLanguageFromSnapshot(snap),
    subtitleLanguage,
    preferredSubtitleLanguages,
    subtitleFormat: subtitle.format,
    languages: subLanguages(subtitleLanguage ?? undefined, preferredSubtitleLanguages),
    meta: buildMeta(src),
  };
}

export function toDriftState(
  snap: PlayerSnapshot,
  cues: SubCue[],
  trackKey: string,
): DriftPlayerState {
  return {
    positionSec: snap.positionSec,
    durationSec: snap.durationSec,
    subDelaySec: snap.subDelaySec,
    playing: snap.status === "playing",
    buffering: snap.buffering,
    rate: snap.rate,
    cues,
    trackKey,
  };
}
