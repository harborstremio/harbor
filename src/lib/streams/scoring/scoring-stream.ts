import { isTrustedGroup } from "../parser";
import type { ParsedStream, ScoredStream, ScoreReason } from "../types";
import { addonPriorityPoints, trustedAddonPoints } from "./scoring-addons";
import { audioPoints, playabilityPenalty } from "./scoring-audio";
import { bitrateBudgetPenalty, expectedMinSizeBytes } from "./scoring-bitrate";
import { isCachedOnActive } from "./scoring-debrid";
import { freshTheatricalAdjust } from "./scoring-recency";
import { resolutionPoints, tierOf } from "./scoring-resolution";
import {
  camInFilenamePenalty,
  impossiblySmallMoviePenalty,
  sizeMislabelPenalty,
  undersizedNewReleasePenalty,
} from "./scoring-size";
import type { CorpusStats, ScoreOptions } from "./scoring-types";

export function scoreStream(s: ParsedStream, opts: ScoreOptions, corpus?: CorpusStats): ScoredStream {
  const reasons: ScoreReason[] = [];
  let score = 0;

  const cached = isCachedOnActive(s, opts.activeDebrids);
  const directPlayable = !!s.url;
  const isEasynews = /easynews/i.test(s.addonName ?? "") || /easynews/i.test(s.parsedTitle ?? "");
  if (cached || isEasynews) {
    score += 60;
    reasons.push({ signal: cached ? "cached" : "easynews-direct", delta: 60 });
  } else if (directPlayable) {
    score += 25;
    reasons.push({ signal: "direct url", delta: 25 });
  }

  const resBoost = resolutionPoints(s);
  if (resBoost.delta) {
    score += resBoost.delta;
    reasons.push(resBoost);
  }

  if (s.hdrFormat) {
    const hdrDelta = s.hdrFormat === "DV+HDR10" || s.hdrFormat === "DV" ? 6 : 5;
    score += hdrDelta;
    reasons.push({ signal: s.hdrFormat, delta: hdrDelta });
  }

  if (s.codec === "HEVC") {
    score += 1;
    reasons.push({ signal: "HEVC", delta: 1 });
  } else if (s.codec === "AV1") {
    score += 1;
    reasons.push({ signal: "AV1", delta: 1 });
  }

  const audioDelta = audioPoints(s);
  if (audioDelta.delta) {
    score += audioDelta.delta;
    reasons.push(audioDelta);
  }

  if (s.audio.channels >= 6) {
    score += 2;
    reasons.push({ signal: `${s.audio.channels}.0 channels`, delta: 2 });
  }

  if (!cached && s.seeders != null) {
    const seedDelta = Math.min(Math.floor(s.seeders / 10), 10);
    if (seedDelta > 0) {
      score += seedDelta;
      reasons.push({ signal: `seeders=${s.seeders}`, delta: seedDelta });
    } else if (!s.url && s.infoHash && s.seeders === 0) {
      score -= 20;
      reasons.push({ signal: "zero-seeders-stale-meta", delta: -20 });
    }
  }
  if (s.infoHash && s.seeders === 0 && !cached) {
    score -= 8;
    reasons.push({ signal: "zero-seeders-soft", delta: -8 });
  }

  const expectedYear = opts.releaseDate ? parseInt(opts.releaseDate.slice(0, 4), 10) : null;
  if (expectedYear != null && Number.isFinite(expectedYear) && s.year != null) {
    const diff = Math.abs(s.year - expectedYear);
    if (diff !== 0) {
      const releaseMs = opts.releaseDate ? Date.parse(opts.releaseDate) : NaN;
      const daysFromRelease = Number.isFinite(releaseMs) ? Math.abs(Date.now() - releaseMs) / 86_400_000 : Infinity;
      const isRecent = daysFromRelease < 365;
      if (diff === 1) {
        const delta = isRecent ? -75 : -18;
        score += delta;
        reasons.push({ signal: `year-off-by-1:${s.year}vs${expectedYear}${isRecent ? "-recent" : ""}`, delta });
      } else {
        const delta = isRecent ? -150 : -70;
        score += delta;
        reasons.push({ signal: `year-mismatch:${s.year}vs${expectedYear}${isRecent ? "-recent" : ""}`, delta });
      }
    }
  }

  if (isTrustedGroup(s.releaseGroupNormalized)) {
    score += 2;
    reasons.push({ signal: `group:${s.releaseGroupNormalized}`, delta: 2 });
  }

  if (
    opts.preferredReleaseGroup &&
    s.releaseGroupNormalized &&
    s.releaseGroupNormalized === opts.preferredReleaseGroup
  ) {
    score += 8;
    reasons.push({ signal: `prev-episode-group:${s.releaseGroupNormalized}`, delta: 8 });
  }

  if (s.remux) {
    score += 3;
    reasons.push({ signal: "REMUX", delta: 3 });
  }

  if (s.source === "CAM") {
    score -= 80;
    reasons.push({ signal: "CAM penalty", delta: -80 });
  } else if (s.source === "TS" || s.source === "HDTS") {
    score -= 60;
    reasons.push({ signal: "Telesync penalty", delta: -60 });
  } else if (s.source === "TC") {
    score -= 50;
    reasons.push({ signal: "Telecine penalty", delta: -50 });
  } else if (s.source === "SCR") {
    score -= 40;
    reasons.push({ signal: "Screener penalty", delta: -40 });
  }

  if (s.proper || s.repackIteration > 0) {
    const r = Math.min(2, s.repackIteration || 1);
    score += r;
    reasons.push({ signal: s.proper ? "PROPER" : `REPACK${s.repackIteration}`, delta: r });
  }

  if (opts.preferredLanguages?.length) {
    if (s.audioLanguages.length === 0) {
      score -= 3;
      reasons.push({ signal: "language-unknown", delta: -3 });
    } else {
      const isMulti = s.audioLanguages.includes("Multi");
      const match = s.audioLanguages.some((l) =>
        opts.preferredLanguages!.some(
          (p) => l.toLowerCase() === p.toLowerCase() || l.toLowerCase().startsWith(p.toLowerCase()),
        ),
      );
      if (match) {
        score += 12;
        reasons.push({ signal: "preferred-language", delta: 12 });
      } else if (isMulti) {
        if (opts.preferSingleAudioTrack) {
          score -= 18;
          reasons.push({ signal: "html5-multi-audio-penalty", delta: -18 });
        } else {
          score += 4;
          reasons.push({ signal: "multi-language", delta: 4 });
        }
      } else {
        score -= 14;
        reasons.push({ signal: "language-mismatch", delta: -14 });
      }
    }
  } else if (opts.preferSingleAudioTrack && s.audioLanguages.includes("Multi")) {
    score -= 12;
    reasons.push({ signal: "html5-multi-audio-penalty", delta: -12 });
  }

  if (s.scamScore > 0) {
    score -= s.scamScore;
    reasons.push({ signal: "scam-penalty", delta: -s.scamScore });
  }

  if (s.url && !cached) {
    score += 4;
    reasons.push({ signal: "prelinked-url", delta: 4 });
  }

  if (opts.preferAddonId && s.addonId === opts.preferAddonId) {
    score += 250;
    reasons.push({ signal: "origin-addon", delta: 250 });
  }

  const trustedAddonBoost = trustedAddonPoints(s);
  if (trustedAddonBoost.delta > 0) {
    score += trustedAddonBoost.delta;
    reasons.push(trustedAddonBoost);
  }

  const addonPriorityBoost = addonPriorityPoints(s);
  if (addonPriorityBoost.delta > 0) {
    score += addonPriorityBoost.delta;
    reasons.push(addonPriorityBoost);
  }

  const playabilityDelta = playabilityPenalty(s);
  if (playabilityDelta < 0) {
    score += playabilityDelta;
    reasons.push({ signal: "webview2-unfriendly", delta: playabilityDelta });
  }

  const bitratePenalty = bitrateBudgetPenalty(s, opts, cached);
  if (bitratePenalty.delta < 0) {
    score += bitratePenalty.delta;
    reasons.push(bitratePenalty);
  }

  const expectedMin = opts.runtimeMinutes ? expectedMinSizeBytes(s.resolution, opts.runtimeMinutes) : null;
  const hasValidSize = !!s.size && !!expectedMin && s.size >= expectedMin;

  const sizePenalty = sizeMislabelPenalty(s, expectedMin);
  if (sizePenalty < 0) {
    score += sizePenalty;
    reasons.push({ signal: "size-mismatch", delta: sizePenalty });
  }

  const desyncPenalty = camInFilenamePenalty(s);
  if (desyncPenalty < 0) {
    score += desyncPenalty;
    reasons.push({ signal: "title-says-hires-filename-says-cam", delta: desyncPenalty });
  }

  const undersizedPenalty = undersizedNewReleasePenalty(s, opts);
  if (undersizedPenalty.delta < 0) {
    score += undersizedPenalty.delta;
    reasons.push(undersizedPenalty);
  }

  const tinyPenalty = impossiblySmallMoviePenalty(s, opts);
  if (tinyPenalty.delta < 0) {
    score += tinyPenalty.delta;
    reasons.push(tinyPenalty);
  }

  const recency = freshTheatricalAdjust(s, opts, hasValidSize, corpus);
  if (recency.delta !== 0) {
    score += recency.delta;
    reasons.push(recency);
  }

  return { ...s, score, reasons, tier: tierOf(s) };
}
