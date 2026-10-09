import type { SubChoiceInput } from "./subtitle-memory";
import type { SubCue } from "./parser";
import { toSrt, toVtt } from "./serialize";

const MAX_SELECTED_SUBTITLE_CHARS = 8 * 1024 * 1024;

type CacheInput = {
  mediaKey: string;
  streamKey?: string;
  choice: SubChoiceInput;
  playableUrl: string | null;
  cues: SubCue[] | null;
};

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function localPath(value: string | null | undefined): string | null {
  if (!value || /^(https?|blob|data|asset):/i.test(value)) return null;
  return value;
}

function cachedFormat(
  choice: SubChoiceInput,
  path: string | null,
): "srt" | "vtt" | "ass" | "ssa" | null {
  if (
    choice.format === "srt" ||
    choice.format === "vtt" ||
    choice.format === "ass" ||
    choice.format === "ssa"
  ) {
    return choice.format;
  }
  const extension = /\.([a-z0-9]+)$/i.exec(path ?? "")?.[1]?.toLowerCase();
  return extension === "srt" || extension === "vtt" || extension === "ass" || extension === "ssa"
    ? extension
    : null;
}

export function selectedSubtitleCacheName(
  mediaKey: string,
  streamKey: string | undefined,
  choice: SubChoiceInput,
  format: "srt" | "vtt" | "ass" | "ssa",
): string {
  const identity = [
    mediaKey,
    streamKey ?? "",
    choice.subId ?? "",
    choice.provider ?? "",
    choice.source ?? choice.url ?? choice.externalFilename ?? "",
  ].join("|");
  return `selected-${stableHash(identity)}.${format}`;
}

export async function cacheSelectedSubtitle(input: CacheInput): Promise<SubChoiceInput | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  const readablePath = localPath(input.playableUrl) ?? localPath(input.choice.source);
  const readableFormat = cachedFormat(input.choice, readablePath);
  let format = readableFormat ?? "srt";
  let text: string | null = null;
  try {
    if (readablePath && readableFormat) {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      text = await readTextFile(readablePath);
    }
  } catch {
    text = null;
  }
  if (!text && input.cues && input.cues.length > 0) {
    if (format !== "vtt") format = "srt";
    text = format === "vtt" ? toVtt(input.cues) : toSrt(input.cues);
  }
  if (!text || text.length > MAX_SELECTED_SUBTITLE_CHARS) return null;

  try {
    const [{ appDataDir, join }, { mkdir, writeTextFile }] = await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const dir = await join(await appDataDir(), "harbor-subs", "selected");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const path = await join(
      dir,
      selectedSubtitleCacheName(input.mediaKey, input.streamKey, input.choice, format),
    );
    await writeTextFile(path, text);
    return {
      ...input.choice,
      source: path,
      url: path,
      externalFilename: path,
      external: true,
      imported: true,
      format,
      encoding: "utf-8",
      providerDerived: false,
    };
  } catch (error) {
    console.warn("[subs/cache] could not persist selected subtitle", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
