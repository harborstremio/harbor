import { Unzip, UnzipInflate } from "fflate";
import { safeFetchBytes } from "@/lib/safe-fetch";
import { languageName, normalizeLang } from "./language";
import { decodeSubtitleBytesDetailed, type SubtitleDecodeResult } from "./encoding";
import { parseSubtitle, type SubCue, type SubFormat } from "./parser";

export const SUBTITLE_PREPARATION_LIMITS = {
  networkBytes: 12 * 1024 * 1024,
  archiveInflatedBytes: 32 * 1024 * 1024,
  archiveEntries: 100,
  subtitleFileBytes: 4 * 1024 * 1024,
  timeoutMs: 15_000,
  minimumCues: 2,
} as const;

export type PreparedSubtitleFormat = "srt" | "vtt" | "ass" | "ssa";

export type PreparedSubtitle = {
  originalUrl: string;
  playableUrl: string;
  format: PreparedSubtitleFormat;
  cues: SubCue[];
  text: string;
  encoding: string;
  encodingHealth: number;
  encodingDiagnostics: SubtitleDecodeResult["diagnostics"];
  release?: string;
  rawFilename?: string;
  archive: boolean;
  cleanup: () => void;
};

export type SubtitlePreparationReason =
  | "timeout"
  | "network-error"
  | "network-limit"
  | "invalid-archive"
  | "unsafe-path"
  | "nested-archive"
  | "too-many-entries"
  | "inflated-limit"
  | "subtitle-limit"
  | "empty-archive"
  | "unsupported-format"
  | "decode-unhealthy"
  | "invalid-cues"
  | "not-supported";

export class SubtitlePreparationError extends Error {
  readonly reason: SubtitlePreparationReason;

  constructor(reason: SubtitlePreparationReason, message: string) {
    super(message);
    this.name = "SubtitlePreparationError";
    this.reason = reason;
  }
}

export type SubtitlePreparationHints = {
  format?: SubFormat;
  encoding?: string;
  language?: string;
  season?: number;
  episode?: number;
  release?: string;
  filename?: string;
  durationSec?: number;
  requestHeaders?: Record<string, string>;
};

export type SubtitlePreparationInput = SubtitlePreparationHints & {
  url: string;
};

export type SubtitlePreparationLimits = {
  networkBytes: number;
  archiveInflatedBytes: number;
  archiveEntries: number;
  subtitleFileBytes: number;
  timeoutMs: number;
  minimumCues: number;
};

export type SubtitlePreparationDependencies = {
  fetchBytes?: (
    url: string,
    signal: AbortSignal,
    timeoutMs: number,
    headers?: Record<string, string>,
    maxBytes?: number,
  ) => Promise<Response>;
  createPlayable?: (
    bytes: Uint8Array,
    format: PreparedSubtitleFormat,
  ) => Promise<{ url: string; cleanup: () => void }>;
  limits?: Partial<SubtitlePreparationLimits>;
};

type ArchiveEntry = { name: string; bytes: Uint8Array };
type ParsedEntry = {
  name: string;
  bytes: Uint8Array;
  format: PreparedSubtitleFormat;
  decode: SubtitleDecodeResult;
  cues: SubCue[];
  score: number;
};

const SUBTITLE_EXTENSIONS = new Set(["srt", "vtt", "ass", "ssa"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "gz", "tgz", "bz2", "xz", "tar"]);

function limitsOf(
  overrides: Partial<SubtitlePreparationLimits> | undefined,
): SubtitlePreparationLimits {
  return { ...SUBTITLE_PREPARATION_LIMITS, ...overrides };
}

function extensionOf(name: string): string {
  const base = name.split(/[?#]/, 1)[0] ?? "";
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function hasZipEndRecord(bytes: Uint8Array): boolean {
  const minimum = Math.max(0, bytes.length - (65_535 + 22));
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (
      bytes[index] !== 0x50 ||
      bytes[index + 1] !== 0x4b ||
      bytes[index + 2] !== 0x05 ||
      bytes[index + 3] !== 0x06
    ) {
      continue;
    }
    const commentLength = bytes[index + 20] | (bytes[index + 21] << 8);
    return index + 22 + commentLength <= bytes.length;
  }
  return false;
}

function assertSafeArchivePath(name: string): void {
  if (!name || name.includes("\0")) {
    throw new SubtitlePreparationError("unsafe-path", "archive contains an invalid path");
  }
  const normalized = name.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new SubtitlePreparationError("unsafe-path", `unsafe archive path: ${name}`);
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function extractSafeSubtitleEntries(
  bytes: Uint8Array,
  limitOverrides?: Partial<SubtitlePreparationLimits>,
): ArchiveEntry[] {
  const limits = limitsOf(limitOverrides);
  if (!isZip(bytes) || !hasZipEndRecord(bytes)) {
    throw new SubtitlePreparationError(
      "invalid-archive",
      "subtitle archive is truncated or invalid",
    );
  }
  const entries: ArchiveEntry[] = [];
  let entryCount = 0;
  let inflatedBytes = 0;
  let failure: SubtitlePreparationError | null = null;

  const fail = (reason: SubtitlePreparationReason, message: string): never => {
    if (failure) throw failure;
    const error = new SubtitlePreparationError(reason, message);
    failure = error;
    throw error;
  };

  try {
    const unzip = new Unzip((file) => {
      if (failure) return;
      entryCount += 1;
      if (entryCount > limits.archiveEntries) {
        fail("too-many-entries", `archive exceeds ${limits.archiveEntries} entries`);
      }
      assertSafeArchivePath(file.name);
      const ext = extensionOf(file.name);
      if (ARCHIVE_EXTENSIONS.has(ext)) {
        fail("nested-archive", `nested archive rejected: ${file.name}`);
      }
      if ((file.originalSize ?? 0) > limits.archiveInflatedBytes) {
        fail("inflated-limit", `archive entry exceeds inflated byte limit: ${file.name}`);
      }
      if (SUBTITLE_EXTENSIONS.has(ext) && (file.originalSize ?? 0) > limits.subtitleFileBytes) {
        fail("subtitle-limit", `subtitle entry exceeds byte limit: ${file.name}`);
      }

      const chunks: Uint8Array[] = [];
      let entryBytes = 0;
      let prefix = new Uint8Array(0);
      file.ondata = (error, chunk, final) => {
        if (error) fail("invalid-archive", `archive extraction failed: ${error.message}`);
        inflatedBytes += chunk.length;
        entryBytes += chunk.length;
        if (inflatedBytes > limits.archiveInflatedBytes) {
          file.terminate?.();
          fail("inflated-limit", `archive exceeds ${limits.archiveInflatedBytes} inflated bytes`);
        }
        if (SUBTITLE_EXTENSIONS.has(ext) && entryBytes > limits.subtitleFileBytes) {
          file.terminate?.();
          fail("subtitle-limit", `subtitle entry exceeds byte limit: ${file.name}`);
        }
        if (prefix.length < 4 && chunk.length > 0) {
          const needed = Math.min(4 - prefix.length, chunk.length);
          const next = new Uint8Array(prefix.length + needed);
          next.set(prefix);
          next.set(chunk.subarray(0, needed), prefix.length);
          prefix = next;
          if (isZip(prefix)) {
            file.terminate?.();
            fail("nested-archive", `nested archive content rejected: ${file.name}`);
          }
        }
        if (SUBTITLE_EXTENSIONS.has(ext)) chunks.push(chunk);
        if (final && SUBTITLE_EXTENSIONS.has(ext)) {
          entries.push({ name: file.name, bytes: concatChunks(chunks, entryBytes) });
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    unzip.push(bytes, true);
  } catch (error) {
    if (failure) throw failure;
    if (error instanceof SubtitlePreparationError) throw error;
    throw new SubtitlePreparationError("invalid-archive", "subtitle archive could not be read");
  }

  if (failure) throw failure;
  if (entries.length === 0) {
    throw new SubtitlePreparationError(
      "empty-archive",
      "archive contains no supported subtitle files",
    );
  }
  return entries;
}

function detectFormat(
  name: string,
  hint: SubFormat | undefined,
  text: string,
): PreparedSubtitleFormat | null {
  const explicit = hint?.toLowerCase();
  if (explicit === "srt" || explicit === "vtt" || explicit === "ass" || explicit === "ssa") {
    return explicit;
  }
  const ext = extensionOf(name);
  if (SUBTITLE_EXTENSIONS.has(ext)) return ext as PreparedSubtitleFormat;
  const head = text.slice(0, 2_000);
  if (/^WEBVTT/i.test(head.trimStart())) return "vtt";
  if (/\[Script Info\]/i.test(head) || /\[V4\+ Styles\]/i.test(head)) return "ass";
  if (/\[V4 Styles\]/i.test(head)) return "ssa";
  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/i.test(head)) return "srt";
  return null;
}

function episodeFromName(name: string): { season?: number; episode?: number } {
  const se = /(?:^|[^a-z0-9])s(\d{1,2})[ ._-]*e(\d{1,3})(?:[^a-z0-9]|$)/i.exec(name);
  if (se) return { season: Number(se[1]), episode: Number(se[2]) };
  const x = /(?:^|[^0-9])(\d{1,2})x(\d{1,3})(?:[^0-9]|$)/i.exec(name);
  if (x) return { season: Number(x[1]), episode: Number(x[2]) };
  return {};
}

function tokens(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

function languageFilenameScore(name: string, language: string | undefined): number {
  const wanted = normalizeLang(language ?? "");
  if (!wanted) return 0;
  const wantedBase = wanted.split("-")[0];
  const wantedName = languageName(wanted).toLowerCase();
  const words = name
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter(Boolean);
  const matches = words.some((word) => {
    const normalized = normalizeLang(word);
    return (
      word === wanted ||
      word === wantedBase ||
      word === wantedName ||
      normalized === wanted ||
      normalized === wantedBase
    );
  });
  return matches ? 1_000 : 0;
}

function candidateScore(name: string, hints: SubtitlePreparationHints): number {
  let score = 0;
  const foundEpisode = episodeFromName(name);
  if (hints.season != null && hints.episode != null) {
    if (foundEpisode.season != null && foundEpisode.episode != null) {
      if (foundEpisode.season !== hints.season || foundEpisode.episode !== hints.episode)
        return -10_000;
      score += 300;
    }
  }
  score += languageFilenameScore(name, hints.language);
  const release = tokens(hints.release);
  const filename = tokens(hints.filename);
  const candidate = tokens(name);
  score += Math.round(overlapScore(candidate, release) * 180);
  score += Math.round(overlapScore(candidate, filename) * 220);
  const wantedBase = (hints.filename ?? "").replace(/\.[a-z0-9]{2,4}$/i, "").toLowerCase();
  const candidateBase = name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .toLowerCase();
  if (wantedBase && wantedBase === candidateBase) score += 500;
  return score;
}

function validateCues(
  cues: SubCue[],
  hints: SubtitlePreparationHints,
  minimumCues: number,
): boolean {
  if (cues.length < minimumCues) return false;
  let valid = 0;
  let previousStart = -1;
  for (const cue of cues) {
    if (
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.start < previousStart ||
      cue.end - cue.start > 120
    ) {
      return false;
    }
    previousStart = cue.start;
    valid += 1;
  }
  const last = cues[cues.length - 1]?.end ?? 0;
  if (hints.durationSec && last > hints.durationSec * 1.25 + 300) return false;
  return valid >= minimumCues && last - cues[0].start >= 1;
}

function parseEntry(
  entry: ArchiveEntry,
  hints: SubtitlePreparationHints,
  minimumCues: number,
  formatHint?: SubFormat,
): ParsedEntry | null {
  const decode = decodeSubtitleBytesDetailed(entry.bytes, {
    encoding: hints.encoding,
    lang: hints.language,
  });
  if (!decode.healthy) return null;
  const format = detectFormat(entry.name, formatHint, decode.text);
  if (!format) return null;
  const cues = parseSubtitle(decode.text, format);
  if (!validateCues(cues, hints, minimumCues)) return null;
  const score = candidateScore(entry.name, hints);
  if (score <= -10_000) return null;
  return {
    ...entry,
    format,
    decode,
    cues,
    score,
  };
}

export async function readSubtitleResponseBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.ok) {
    throw new SubtitlePreparationError(
      "network-error",
      `subtitle fetch failed with status ${response.status}`,
    );
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SubtitlePreparationError(
      "network-limit",
      `subtitle download exceeds ${maxBytes} bytes`,
    );
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) {
      throw new SubtitlePreparationError(
        "network-limit",
        `subtitle download exceeds ${maxBytes} bytes`,
      );
    }
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new SubtitlePreparationError(
          "network-limit",
          `subtitle download exceeds ${maxBytes} bytes`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concatChunks(chunks, total);
}

async function defaultFetchBytes(
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
  headers?: Record<string, string>,
  maxBytes?: number,
): Promise<Response> {
  return safeFetchBytes(url, { method: "GET", signal, headers }, timeoutMs, maxBytes);
}

async function defaultCreatePlayable(
  bytes: Uint8Array,
  format: PreparedSubtitleFormat,
): Promise<{ url: string; cleanup: () => void }> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const [{ tempDir, join }, fs] = await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const dir = await join(await tempDir(), "harbor-subs", "prepared");
    const random =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const privateDir = await join(dir, random);
    await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
    const path = await join(privateDir, `subtitle.${format}`);
    await fs.writeFile(path, bytes, { createNew: true, mode: 0o600 });
    return {
      url: path,
      cleanup: () => {
        void fs.remove(privateDir, { recursive: true }).catch(() => {});
      },
    };
  }
  if (
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new SubtitlePreparationError("not-supported", "playable subtitle URLs are unavailable");
  }
  const blob = new Blob([bytes.slice().buffer], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}

export async function prepareSubtitleBytes(
  originalUrl: string,
  bytes: Uint8Array,
  hints: SubtitlePreparationHints = {},
  dependencies: SubtitlePreparationDependencies = {},
): Promise<PreparedSubtitle> {
  const limits = limitsOf(dependencies.limits);
  if (bytes.length > limits.networkBytes) {
    throw new SubtitlePreparationError(
      "network-limit",
      `subtitle download exceeds ${limits.networkBytes} bytes`,
    );
  }
  const archive = isZip(bytes);
  if (!archive && bytes.length > limits.subtitleFileBytes) {
    throw new SubtitlePreparationError(
      "subtitle-limit",
      `subtitle file exceeds ${limits.subtitleFileBytes} bytes`,
    );
  }
  const entries = archive
    ? extractSafeSubtitleEntries(bytes, limits)
    : [{ name: hints.filename || originalUrl, bytes }];
  const parsed = entries
    .map((entry) =>
      parseEntry(entry, hints, limits.minimumCues, archive ? undefined : hints.format),
    )
    .filter((entry): entry is ParsedEntry => entry != null)
    .sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const best = parsed[0];
  if (!best) {
    const attemptedDecode = entries[0]
      ? decodeSubtitleBytesDetailed(entries[0].bytes, {
          encoding: hints.encoding,
          lang: hints.language,
        })
      : null;
    if (attemptedDecode && !attemptedDecode.healthy) {
      throw new SubtitlePreparationError(
        "decode-unhealthy",
        "subtitle text could not be decoded safely",
      );
    }
    const format = entries[0]
      ? detectFormat(entries[0].name, hints.format, attemptedDecode?.text ?? "")
      : null;
    throw new SubtitlePreparationError(
      format ? "invalid-cues" : "unsupported-format",
      format ? "subtitle cues failed validation" : "unsupported subtitle format",
    );
  }
  const utf8 = new TextEncoder().encode(best.decode.text);
  const playable = await (dependencies.createPlayable ?? defaultCreatePlayable)(utf8, best.format);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    playable.cleanup();
  };
  return {
    originalUrl,
    playableUrl: playable.url,
    format: best.format,
    cues: best.cues,
    text: best.decode.text,
    encoding: best.decode.encoding,
    encodingHealth: best.decode.healthScore,
    encodingDiagnostics: best.decode.diagnostics,
    release: hints.release,
    rawFilename: best.name,
    archive,
    cleanup,
  };
}

export async function prepareSubtitle(
  input: SubtitlePreparationInput,
  dependencies: SubtitlePreparationDependencies = {},
): Promise<PreparedSubtitle> {
  const limits = limitsOf(dependencies.limits);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limits.timeoutMs);
  try {
    const response = await (dependencies.fetchBytes ?? defaultFetchBytes)(
      input.url,
      controller.signal,
      limits.timeoutMs,
      input.requestHeaders,
      limits.networkBytes,
    );
    const bytes = await readSubtitleResponseBytes(response, limits.networkBytes);
    return await prepareSubtitleBytes(input.url, bytes, input, dependencies);
  } catch (error) {
    if (error instanceof SubtitlePreparationError) throw error;
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/response size limit|exceeds .*bytes/i.test(message)) {
      throw new SubtitlePreparationError(
        "network-limit",
        "subtitle download exceeds the byte limit",
      );
    }
    if (timedOut || (error as { name?: string } | null)?.name === "AbortError") {
      throw new SubtitlePreparationError("timeout", "subtitle preparation timed out");
    }
    throw new SubtitlePreparationError("network-error", "subtitle preparation failed");
  } finally {
    clearTimeout(timer);
  }
}

export type PreparedCandidateResult<T> =
  | { status: "prepared"; candidate: T; prepared: PreparedSubtitle; rank: number }
  | { status: "failed"; candidate: T; error: SubtitlePreparationError; rank: number };

export async function prepareRankedSubtitleCandidates<T>(
  candidates: T[],
  prepare: (candidate: T) => Promise<PreparedSubtitle>,
  limit = 3,
): Promise<PreparedCandidateResult<T>[]> {
  const selected = candidates.slice(0, Math.max(0, limit));
  return Promise.all(
    selected.map(async (candidate, rank): Promise<PreparedCandidateResult<T>> => {
      try {
        return { status: "prepared", candidate, prepared: await prepare(candidate), rank };
      } catch (error) {
        const failure =
          error instanceof SubtitlePreparationError
            ? error
            : new SubtitlePreparationError("network-error", "subtitle preparation failed");
        return { status: "failed", candidate, error: failure, rank };
      }
    }),
  );
}
