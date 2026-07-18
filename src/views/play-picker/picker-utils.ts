import {
  hdrBadge,
  qualityConfidence,
  releaseSourceBadge,
  resolutionBadge,
  sourceBadge,
  type BadgeKind,
} from "@/components/format-badge";
import type { Meta } from "@/lib/cinemeta";
import type { Rejection } from "@/lib/streams/trust";
import type { Addon } from "@/lib/addons";
import type { ScoredStream, Stream, Tier } from "@/lib/streams/types";
import { hasCachedMarker } from "@/lib/streams/cached";
import type { PlayEpisode } from "@/lib/view";

export async function cinemetaImdbFallback(
  name: string,
  type: "movie" | "series",
  releaseInfo?: string,
): Promise<string | null> {
  if (!name) return null;
  const targetYear = releaseInfo ? parseInt(releaseInfo, 10) : null;
  const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(name)}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      metas?: Array<{ id: string; name: string; releaseInfo?: string }>;
    };
    const metas = Array.isArray(data?.metas) ? data.metas : [];
    const wantNorm = name.trim().toLowerCase();
    for (const m of metas) {
      if (!m.id?.startsWith("tt")) continue;
      if ((m.name ?? "").trim().toLowerCase() !== wantNorm) continue;
      const entryYear = m.releaseInfo ? parseInt(m.releaseInfo, 10) : null;
      if (targetYear != null && entryYear != null && Math.abs(entryYear - targetYear) > 1) continue;
      return m.id;
    }
    return null;
  } catch {
    return null;
  }
}

export function contributorLabel(s: ScoredStream): string {
  const contribs = s.contributors;
  if (!contribs || contribs.length <= 1) return s.addonName;
  if (contribs.length === 2) return `${contribs[0].name} + ${contribs[1].name}`;
  return `${contribs[0].name} + ${contribs.length - 1} more`;
}

export function addonInstanceKey(s: { addonUrl?: string; addonId: string }): string {
  return s.addonUrl ?? s.addonId;
}

export function addonConfigHint(url?: string): string {
  if (!url) return "";
  if (/torbox=/i.test(url)) return "TorBox";
  if (/realdebrid=/i.test(url)) return "RealDebrid";
  if (/alldebrid=/i.test(url)) return "AllDebrid";
  if (/premiumize=/i.test(url)) return "Premiumize";
  if (/debridlink=/i.test(url)) return "DebridLink";
  if (/easydebrid=/i.test(url)) return "EasyDebrid";
  if (/offcloud=/i.test(url)) return "Offcloud";
  return "";
}

export function buildAddonOptions(
  streams: ScoredStream[],
  rank?: Map<string, number>,
): Array<{ id: string; name: string; count: number }> {
  const seen = new Map<string, { name: string; url?: string; count: number }>();
  for (const s of streams) {
    const key = addonInstanceKey(s);
    const existing = seen.get(key);
    if (existing) existing.count += 1;
    else seen.set(key, { name: s.addonName ?? s.addonId, url: s.addonUrl, count: 1 });
  }
  const opts = [...seen.entries()].map(([id, v]) => ({
    id,
    name: v.name,
    url: v.url,
    count: v.count,
  }));
  const nameCounts = new Map<string, number>();
  for (const o of opts) nameCounts.set(o.name, (nameCounts.get(o.name) ?? 0) + 1);
  for (const o of opts) {
    if ((nameCounts.get(o.name) ?? 0) > 1) {
      const hint = addonConfigHint(o.url) || "P2P";
      o.name = `${o.name} · ${hint}`;
    }
  }
  if (rank) {
    opts.sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  } else {
    opts.sort((a, b) => a.name.localeCompare(b.name));
  }
  return opts.map(({ id, name, count }) => ({ id, name, count }));
}

export function streamMatchesLangs(s: ScoredStream, prefs: string[]): boolean {
  if (s.audioLanguages.length === 0) return true;
  if (s.audioLanguages.includes("Multi")) return true;
  return s.audioLanguages.some((l) =>
    prefs.some(
      (p) => l.toLowerCase() === p.toLowerCase() || l.toLowerCase().startsWith(p.toLowerCase()),
    ),
  );
}

export function abbreviateLanguages(langs: string[]): string {
  if (langs.length === 0) return "";
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const l of langs) {
    const code = langCode(l);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.join(", ");
}

export function normalizeLangCode(s: string): string {
  const lower = s.trim().toLowerCase();
  if (lower === "jp") return "ja";
  const nameToCode: Record<string, string> = {
    english: "en",
    portuguese: "pt",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    japanese: "ja",
    korean: "ko",
    chinese: "zh",
    russian: "ru",
    hindi: "hi",
    arabic: "ar",
    dutch: "nl",
    polish: "pl",
    turkish: "tr",
    swedish: "sv",
    norwegian: "no",
    danish: "da",
    finnish: "fi",
    czech: "cs",
    hungarian: "hu",
    romanian: "ro",
    hebrew: "he",
    thai: "th",
    vietnamese: "vi",
    ukrainian: "uk",
  };
  if (nameToCode[lower]) return nameToCode[lower];
  return lower.slice(0, 2);
}

export function langCode(name: string): string {
  const map: Record<string, string> = {
    English: "EN",
    Portuguese: "PT",
    Spanish: "ES",
    French: "FR",
    German: "DE",
    Italian: "IT",
    Japanese: "JA",
    Korean: "KO",
    Chinese: "ZH",
    Russian: "RU",
    Hindi: "HI",
    Arabic: "AR",
    Dutch: "NL",
    Polish: "PL",
    Turkish: "TR",
    Swedish: "SV",
    Norwegian: "NO",
    Danish: "DA",
    Finnish: "FI",
    Czech: "CS",
    Hungarian: "HU",
    Romanian: "RO",
    Hebrew: "HE",
    Thai: "TH",
    Vietnamese: "VI",
    Ukrainian: "UK",
  };
  return map[name] ?? name.slice(0, 2).toUpperCase();
}

export function parseRuntimeMinutes(runtime: string | number | undefined): number | undefined {
  if (runtime == null) return undefined;
  if (typeof runtime === "number") return runtime > 0 ? runtime : undefined;
  const m = /(\d+)/.exec(runtime);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function streamLeadLabel(stream: ScoredStream, t: Tier): string {
  if (isRoughSource(stream)) {
    if (stream.source === "CAM") return "Cam Recording";
    if (stream.source === "TS" || stream.source === "HDTS") return "Telesync";
    if (stream.source === "TC") return "Telecine";
    if (stream.source === "SCR") return "Screener";
  }
  const confidence = qualityConfidence(stream);
  if (confidence === "unlabeled") return "No Label";
  if (confidence === "unverified") return "Unverified";
  switch (t) {
    case "4K_DV":
      return "Ultra HD · Dolby Vision";
    case "4K_HDR":
      return "Ultra HD · HDR";
    case "4K":
      return "Ultra HD";
    case "1080p_HDR":
      return "Full HD · HDR";
    case "1080p":
      return "Full HD";
    case "720p":
      return "HD";
    case "SD":
      return "Standard Def";
    case "ROUGH":
      return "Theater Capture";
  }
}

export function streamLeadBadge(stream: ScoredStream, t: Tier): BadgeKind {
  if (stream.source === "CAM") return "cam";
  if (stream.source === "TS" || stream.source === "HDTS") return "telesync";
  if (stream.source === "TC") return "telecine";
  const confidence = qualityConfidence(stream);
  if (confidence === "unlabeled") return "no-label";
  if (confidence === "unverified") return "unknown";
  switch (t) {
    case "4K_DV":
    case "4K_HDR":
    case "4K":
      return "4k-uhd";
    case "1080p_HDR":
    case "1080p":
      return "1080p";
    case "720p":
      return "720p";
    case "SD":
      return "sd";
    case "ROUGH":
      return "telesync";
  }
}

export function groupRejections(rejected: Rejection[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of rejected) {
    const label = rejectionLabel(r.reason);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function rejectionLabel(reason: string): string {
  if (reason.startsWith("suspicious-extension:")) return "sketchy files";
  if (reason.startsWith("cinema-window-")) return "cam rips";
  if (reason === "size-stub") return "tiny stubs";
  if (reason.startsWith("size-too-large-")) return "oversized";
  if (reason.startsWith("year-mismatch")) return "year mismatch";
  if (reason.startsWith("season-mismatch") || reason.startsWith("episode-mismatch"))
    return "wrong episode";
  if (reason === "season-pack-no-file-idx") return "season packs";
  if (reason.startsWith("scam-score-")) return "scam metadata";
  if (reason === "dead-torrent-zero-seeders") return "dead torrents";
  if (reason === "language-mismatch") return "language";
  if (reason === "trailer-or-extra") return "trailers/extras";
  if (reason === "movie-stub-too-small") return "stub files";
  if (reason === "title-mismatch") return "wrong movie";
  return reason;
}

export function isRoughSource(s: ScoredStream): boolean {
  return (
    s.source === "CAM" ||
    s.source === "TS" ||
    s.source === "HDTS" ||
    s.source === "TC" ||
    s.source === "SCR"
  );
}

export function confirmationLabel(meta: Meta, stream: ScoredStream): string | null {
  const parts: string[] = [];
  const year =
    stream.year ??
    (meta.releaseInfo ? parseInt(meta.releaseInfo, 10) : null) ??
    (meta.releaseDate ? new Date(meta.releaseDate).getFullYear() : null);
  if (year && !Number.isNaN(year)) parts.push(String(year));
  if (isRoughSource(stream)) {
    if (stream.source === "CAM") parts.push("In Theatres");
    else if (stream.source === "TS" || stream.source === "HDTS") parts.push("Theatrical Capture");
    else if (stream.source === "TC") parts.push("Telecine Print");
    else if (stream.source === "SCR") parts.push("Screener Copy");
  } else if (meta.type === "movie") {
    if (stream.source === "BDRip") parts.push("Disc Source");
    else if (stream.source === "WEB-DL" || stream.source === "WEBRip") parts.push("Web Release");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function tierChipBadges(s: ScoredStream): BadgeKind[] {
  const out: BadgeKind[] = [];
  const src = sourceBadge(s);
  const confidence = qualityConfidence(s);
  if (src) {
    out.push(src);
  } else if (confidence === "unlabeled") {
    out.push("no-label");
  } else if (confidence === "unverified") {
    out.push("unknown");
  } else {
    const r = resolutionBadge(s);
    if (r) out.push(r);
  }
  const release = releaseSourceBadge(s);
  if (release && !src) out.push(release);
  const h = hdrBadge(s);
  if (h) out.push(h);
  return out;
}

export function displayTitle(s: ScoredStream, showName: string, episode?: PlayEpisode): string {
  const raw = s.name?.trim();
  if (raw) return raw;
  if (!episode) {
    const filename = s.behaviorHints?.filename ?? s.behaviorHints?.fileName ?? "";
    const firstLine = (s.title ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    return filename || firstLine || s.name || showName || s.parsedTitle || "";
  }
  const parts = [showName || s.parsedTitle];
  parts.push(
    `S${String(episode.imdbSeason ?? episode.season).padStart(2, "0")}E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`,
  );
  if (episode.name) parts.push(episode.name);
  else if (s.episodeTitle) parts.push(s.episodeTitle);
  return parts.filter(Boolean).join(" · ");
}

export function torrentFilename(s: ScoredStream): string {
  const fn = s.behaviorHints?.filename ?? s.behaviorHints?.fileName;
  if (fn && fn.trim()) return fn.trim();
  const firstLine = (s.title ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ?? "";
}

export function streamSummaryParts(s: ScoredStream): string[] {
  const parts: string[] = [];
  if (s.size != null) parts.push(formatSize(s.size));
  if (s.audio.codec !== "Other") parts.push(s.audio.codec);
  if (s.audio.channels >= 6) {
    const label = s.audio.channels === 8 ? "7.1" : s.audio.channels === 7 ? "6.1" : "5.1";
    parts.push(label);
  }
  if (s.codec !== "Other") parts.push(s.codec);
  if (s.hdrFormat) parts.push(s.hdrFormat);
  if (s.seeders != null) parts.push(`${s.seeders} seeds`);
  return parts;
}

const HDR_LABEL: Record<string, string> = {
  HDR10: "HDR10",
  "HDR10+": "HDR10+",
  DV: "Dolby Vision",
  "DV+HDR10": "Dolby Vision",
  HLG: "HLG",
};

export function formatStreamQuality(s: ScoredStream): string {
  const parts: string[] = [];
  if (s.resolution) parts.push(s.resolution);
  if (s.hdrFormat) parts.push(HDR_LABEL[s.hdrFormat] ?? s.hdrFormat);
  if (s.audio.codec !== "Other") {
    const ch =
      s.audio.channels === 8
        ? " 7.1"
        : s.audio.channels === 7
          ? " 6.1"
          : s.audio.channels === 6
            ? " 5.1"
            : "";
    parts.push(`${s.audio.codec}${ch}`);
  }
  return parts.join(" · ");
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${bytes} B`;
}

export function hasInstantMarker(s: ScoredStream): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`.toLowerCase();
  return /\binstant\b/.test(haystack) || haystack.includes("⚡");
}

export { hasUncachedMarker } from "@/lib/streams/cached";
export { hasCachedMarker };

export function anyStreamCached(s: ScoredStream): boolean {
  return Object.values(s.cached).some((v) => v === true) || hasCachedMarker(s);
}

const DEBRID_FAIL_CODES = new Set([
  "all-debrids-failed",
  "stub-or-error-video",
  "no-debrid-could-play",
  "timeout",
  "stalled",
  "error",
  "still-downloading",
]);

export function isDebridFailure(
  code: string,
  tried?: Array<{ slug: string; code: string }>,
): boolean {
  if (DEBRID_FAIL_CODES.has(code)) return true;
  if (tried && tried.length > 0) {
    return tried.every((t) => t.slug !== "direct" && DEBRID_FAIL_CODES.has(t.code));
  }
  return false;
}

export function isWatchHub(s: ScoredStream): boolean {
  return /watchhub/i.test(s.addonId) || /watchhub/i.test(s.addonName ?? "");
}

const NEEDS_DOWNLOAD_RX = /[⏳⌛⬇⏬🔽📥]|\bdownload(ing)?\b|\bqueued?\b|\bnot[\s_-]?cached\b/iu;
export function needsDownload(s: ScoredStream): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  return NEEDS_DOWNLOAD_RX.test(haystack);
}

export const ENGINE_WARMING_MESSAGE =
  "Harbor's peer-to-peer engine is warming up. This clears on its own in a few seconds, then Play works.";

export function isEngineWarmingError(msg: string | null): boolean {
  return msg === ENGINE_WARMING_MESSAGE;
}

export function humanError(code: string): string {
  switch (code) {
    case "not-cached":
      return "This stream isn't cached on your debrid yet. Try a different one from the list.";
    case "still-downloading":
      return "Your debrid is still adding this torrent. Give it 30-60s and hit Play again, or pick a cached source from the list.";
    case "timeout":
      return "Your debrid took too long to respond. Hit Play again, or try another stream.";
    case "stalled":
      return "Your debrid couldn't fetch this torrent (no seeders). Pick a different source.";
    case "error":
      return "Your debrid hit an error on this torrent. Pick a different source.";
    case "stub-or-error-video":
      return "Your debrid served a placeholder/error video instead of the real file. Pick another stream.";
    case "all-debrids-failed":
      return "None of your debrid services could deliver a working file. Pick another stream.";
    case "no-debrid-could-play":
      return "None of your debrid services could resolve this stream. Try a different one.";
    case "no-debrid-configured":
      return "Add a debrid provider in Settings first.";
    case "remote-server-unreachable-strict":
      return "Remote streaming server unreachable. Strict mode is on, so local fallback is disabled.";
    case "remote-server-unreachable":
      return "Remote streaming server unreachable. Check the address in Settings > P2P & servers and that the server machine is online.";
    case "engine-no-peers":
      return "Couldn't reach any peers for this torrent. If this keeps happening, your network or ISP is likely blocking torrents (the local port doesn't matter) - use a debrid service or a VPN.";
    case "engine-not-ready":
      return ENGINE_WARMING_MESSAGE;
    case "direct-torrent-disabled":
      return "Direct torrent streaming is turned off. Turn it on in Settings > P2P & servers to stream torrents without a debrid.";
    case "no-source":
      return "This stream has no playable source.";
    case "addon-not-configured":
      return "This addon isn't fully configured. Open its setup page and finish the wizard.";
    case "external-url-only":
      return "This source only opens in an external browser, not in Harbor's player.";
    case "youtube-only":
      return "This is a YouTube link, not a video file. Open it in a browser instead.";
    case "nzb-needs-external-player":
      return "This is a raw NZB file. It needs SABnzbd or NZBGet to download first, then play.";
    case "unauthorized":
      return "Your debrid key was rejected. Check it in Settings.";
    case "not-premium":
      return "Your debrid subscription has expired.";
    case "rate-limited":
      return "The debrid service is rate-limiting us. Try again in a moment.";
    case "aborted":
      return "Cancelled.";
    default:
      return `Couldn't play this stream (${code}).`;
  }
}

function streamIdentity(s: {
  addonId: string;
  infoHash?: string;
  fileIdx?: number;
  url?: string;
  title?: string;
  name?: string;
}): string {
  const base = s.infoHash
    ? `h:${s.infoHash}:${s.fileIdx ?? ""}`
    : `u:${s.url ?? s.title ?? s.name ?? ""}`;
  return `${s.addonId}:${base}`;
}

export function stampAddonOrder(streams: ScoredStream[], rawAddon: Stream[]): void {
  if (rawAddon.length === 0) return;
  const arrival = new Map<string, number>();
  const byIdentity = new Map<string, Stream>();
  rawAddon.forEach((s, i) => {
    const k = streamIdentity(s);
    if (!arrival.has(k)) {
      arrival.set(k, i);
      byIdentity.set(k, s);
    }
  });
  for (const s of streams) {
    const k = streamIdentity(s);
    const idx = arrival.get(k);
    if (idx !== undefined) s.nativeIdx = idx;
    const raw = byIdentity.get(k);
    if (raw) {
      s.addonUrl ??= raw.addonUrl;
      s.addonRanked ??= raw.addonRanked;
    }
  }
}

export function orderByAddonNative(
  streams: ScoredStream[],
  rawAddon: Stream[],
  addons: Addon[] | null,
): ScoredStream[] {
  const rank = new Map<string, number>();
  (addons ?? []).forEach((a, i) => {
    if (a.transportUrl) rank.set(a.transportUrl, i);
  });
  const arrival = new Map<string, number>();
  rawAddon.forEach((s, i) => {
    const k = streamIdentity(s);
    if (!arrival.has(k)) arrival.set(k, i);
  });
  const BIG = Number.MAX_SAFE_INTEGER;
  const arrivalOf = (s: ScoredStream): number =>
    s.nativeIdx ?? arrival.get(streamIdentity(s)) ?? BIG;
  return streams.slice().sort((a, b) => {
    const ar = rank.get(a.addonUrl ?? "") ?? BIG;
    const br = rank.get(b.addonUrl ?? "") ?? BIG;
    if (ar !== br) return ar - br;
    const ai = arrivalOf(a);
    const bi = arrivalOf(b);
    if (ai !== bi) return ai - bi;
    return b.score - a.score;
  });
}
