import type { SubResult } from "./types";
import type { SubSearchQuery } from "./types";
import { subtitleReleaseLabel } from "./release-label.ts";

function meaningfulRelease(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length <= 3 || !/[a-z0-9]{2}/i.test(trimmed)) return undefined;
  return trimmed;
}

const UPSTREAM_PROVIDERS: Array<[RegExp, string]> = [
  [/(?:^|[^a-z])sub[ ._-]*dl(?:[^a-z]|$)|subdl\.com|subdl\.strem\./i, "SubDL"],
  [/(?:^|[^a-z])sub[ ._-]*source(?:[^a-z]|$)|subsource\.(?:net|strem\.)/i, "Subsource"],
];

export function inferSubtitleUpstreamProvider(
  ...values: Array<string | null | undefined>
): string | undefined {
  for (const value of values) {
    if (!value) continue;
    for (const [pattern, label] of UPSTREAM_PROVIDERS) {
      if (pattern.test(value)) return label;
    }
  }
  return undefined;
}

export function subtitleFpsFromMetadata(
  explicit: number | string | null | undefined,
  ...labels: Array<string | null | undefined>
): number | undefined {
  const numeric = typeof explicit === "number" ? explicit : Number(explicit);
  if (Number.isFinite(numeric) && numeric >= 10 && numeric <= 120) return numeric;

  for (const label of labels) {
    const match = label?.match(
      /(?:^|[^\d])((?:1[0-9]|[2-9][0-9]|1[01][0-9])(?:\.\d{1,3})?)\s*fps\b/i,
    );
    const fps = Number(match?.[1]);
    if (Number.isFinite(fps) && fps >= 10 && fps <= 120) return fps;
  }
  return undefined;
}

export function providerLabel(r: Pick<SubResult, "source" | "title" | "upstreamProvider">): string {
  switch (r.source) {
    case "opensubtitles":
      return "OpenSubtitles";
    case "wyzie":
      return "Wyzie";
    case "subdl":
      return "SubDL";
    case "subsource":
      return "SubSource";
    case "podnapisi":
      return "Podnapisi";
    case "gestdown":
      return "Gestdown";
    case "jimaku":
      return "Jimaku";
    case "addon":
      if (r.upstreamProvider && r.title && r.upstreamProvider !== r.title) {
        return `${r.upstreamProvider} · ${r.title}`;
      }
      return r.upstreamProvider || r.title || "Addon";
    default:
      return r.source;
  }
}

export function releaseOf(r: Pick<SubResult, "source" | "title" | "release">): string | undefined {
  const rel = meaningfulRelease(r.release);
  if (rel) return rel;
  if (r.source === "addon") return undefined;
  const title = meaningfulRelease(r.title);
  return title || undefined;
}

function filenameFromUrl(url: string): string | undefined {
  try {
    const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() ?? "")
      .replace(/\.(srt|vtt|ass|ssa|sub|zip)$/i, "")
      .replace(/[._]+/g, " ")
      .trim();
    if (
      name.length > 3 &&
      /[a-z]{2}/i.test(name) &&
      !/^(subtitle|subtitles|download)$/i.test(name)
    ) {
      return name;
    }
  } catch {}
  return undefined;
}

export function subtitleTitleOf(
  r: Pick<SubResult, "source" | "title" | "displayTitle" | "release" | "url" | "upstreamProvider">,
): string {
  return releaseOf(r) ?? filenameFromUrl(r.url) ?? r.displayTitle ?? providerLabel(r);
}

export function subtitleContextTitle(
  q: Pick<SubSearchQuery, "title" | "season" | "episode" | "filename">,
): string | undefined {
  const title = meaningfulRelease(q.title);
  const episode =
    q.season != null && q.episode != null
      ? `S${String(q.season).padStart(2, "0")}E${String(q.episode).padStart(2, "0")}`
      : undefined;
  const release = subtitleReleaseLabel(q.filename);
  const parts = [title, episode, release].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function subtitleStreamDescriptor(
  stream:
    | {
        title?: string | null;
        parsedTitle?: string | null;
        source?: string | null;
        resolution?: string | null;
        quality?: string | null;
        releaseGroup?: string | null;
      }
    | null
    | undefined,
): string | undefined {
  if (!stream) return undefined;
  const parts = [
    stream.title,
    stream.parsedTitle,
    stream.source === "Other" ? null : stream.source,
    stream.resolution,
    stream.quality,
    stream.releaseGroup,
  ]
    .map((part) => part?.trim())
    .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
