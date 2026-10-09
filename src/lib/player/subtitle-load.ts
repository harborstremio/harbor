import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";

export type { SubtitleLoadMetadata } from "@/lib/subtitles/types";

export type SubtitleAddHandler = (
  url: string,
  lang?: string,
  title?: string,
  metadata?: SubtitleLoadMetadata,
) => void | Promise<boolean | void>;

export function subtitleDownloadArgs(
  url: string,
  metadata: SubtitleLoadMetadata & { lang?: string } = {},
) {
  return {
    url,
    lang: metadata.lang ?? null,
    format: metadata.format ?? null,
    encoding: metadata.encoding ?? null,
  };
}
