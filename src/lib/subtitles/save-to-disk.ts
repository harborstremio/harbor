import { downloadText } from "@/lib/download-text";
import { markLimitReached } from "./limit-signal";
import { providerSubtitleDownloadHeaders, type SubtitleDownloadAuth } from "./provider-auth";
import {
  prepareSubtitle,
  prepareSubtitleBytes,
  readSubtitleResponseBytes,
  SUBTITLE_PREPARATION_LIMITS,
  SubtitlePreparationError,
  type PreparedSubtitle,
  type SubtitlePreparationHints,
} from "./prepare";

export type SaveSubtitleOptions = {
  title?: string;
  lang?: string;
  format?: string;
  label: string;
  downloadAuth?: SubtitleDownloadAuth;
};

function localPathFromUrl(url: string): string {
  if (!url.toLowerCase().startsWith("file:")) return url;
  const parsed = new URL(url);
  const decoded = decodeURIComponent(parsed.pathname);
  return /^\/[a-z]:\//i.test(decoded) ? decoded.slice(1) : decoded;
}

async function prepareNonNetworkSubtitle(
  url: string,
  hints: SubtitlePreparationHints,
): Promise<PreparedSubtitle> {
  let bytes: Uint8Array;
  const isLocalPath =
    /^file:/i.test(url) ||
    /^[a-z]:[\\/]/i.test(url) ||
    url.startsWith("\\\\") ||
    url.startsWith("/");
  if (isLocalPath && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const fs = await import("@tauri-apps/plugin-fs");
    const path = localPathFromUrl(url);
    const info = await fs.stat(path);
    if (info.size > SUBTITLE_PREPARATION_LIMITS.networkBytes) {
      throw new SubtitlePreparationError("network-limit", "subtitle file exceeds the byte limit");
    }
    bytes = await fs.readFile(path);
  } else {
    const response = await fetch(url);
    if (!response.ok) {
      throw new SubtitlePreparationError(
        "network-error",
        `subtitle fetch failed with status ${response.status}`,
      );
    }
    bytes = await readSubtitleResponseBytes(response, SUBTITLE_PREPARATION_LIMITS.networkBytes);
  }
  return prepareSubtitleBytes(url, bytes, hints);
}

export async function prepareSubtitleForSave(
  url: string,
  opts: Omit<SaveSubtitleOptions, "label">,
): Promise<PreparedSubtitle> {
  const hints: SubtitlePreparationHints = {
    language: opts.lang,
    format: opts.format as "srt" | "vtt" | "ass" | "ssa" | "sub" | undefined,
    release: opts.title,
    filename: opts.title,
  };
  return /^https?:/i.test(url)
    ? prepareSubtitle({
        url,
        ...hints,
        requestHeaders: providerSubtitleDownloadHeaders(opts.downloadAuth, url),
      })
    : prepareNonNetworkSubtitle(url, hints);
}

export async function saveSubtitleToDisk(
  url: string,
  opts: SaveSubtitleOptions,
): Promise<"ok" | "failed" | "limited"> {
  try {
    const prepared = await prepareSubtitleForSave(url, opts);
    const base = (opts.title || opts.lang || "subtitle").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
    try {
      const ok = await downloadText(
        `${base}.${prepared.format}`,
        prepared.text,
        [prepared.format],
        opts.label,
      );
      return ok ? "ok" : "failed";
    } finally {
      prepared.cleanup();
    }
  } catch (error) {
    if (error instanceof SubtitlePreparationError && /429|rate.?limit/i.test(error.message)) {
      markLimitReached(url);
      return "limited";
    }
    return "failed";
  }
}
