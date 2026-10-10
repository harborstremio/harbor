import { safeFetch } from "@/lib/safe-fetch";
import { RETRO_LOGO_FOLDERS } from "./hero-logo-data";
import { sourcePlatformId } from "./source-platform";
import type { SourceRelease } from "./sources";

const folders: Readonly<Record<number,string>> = { ...RETRO_LOGO_FOLDERS,
  7:"Sony - PlayStation",8:"Sony - PlayStation 2",9:"Sony - PlayStation 3",38:"Sony - PlayStation Portable",46:"Sony - PlayStation Vita",
  20:"Nintendo - Nintendo DS",21:"Nintendo - GameCube",5:"Nintendo - Wii",41:"Nintendo - Wii U",37:"Nintendo - Nintendo 3DS",
  29:"Sega - Mega Drive - Genesis",32:"Sega - Saturn",23:"Sega - Dreamcast",35:"Sega - Game Gear",64:"Sega - Master System - Mark III",
};

/** Libretro's exact system + playlist filename convention preserves region, hacks and disc identity.
 * https://github.com/libretro-thumbnails/libretro-thumbnails#file--naming-guidelines */
export function sourceRomArtworkUrls(release: Pick<SourceRelease,"platform"|"title">): string[] {
  const folder = folders[sourcePlatformId(release.platform) ?? -1], title = release.title.trim();
  if (!folder || !title || title.length > 300 || /[\x00-\x1f\x7f]/.test(title)) return [];
  const name = title.replace(/[&*/:`<>?\\|"]/g,"_");
  return ["Named_Boxarts","Named_Titles"].map(kind => `https://thumbnails.libretro.com/${encodeURIComponent(folder)}/${kind}/${encodeURIComponent(name)}.png`);
}

/** Check at most two exact assets; a title screen is preferable to an unrelated game's cover. */
export async function loadSourceRomArtwork(release: SourceRelease, signal: AbortSignal): Promise<string|undefined> {
  for (const url of sourceRomArtworkUrls(release)) {
    signal.throwIfAborted();
    try {
      const response = await safeFetch(url,{method:"HEAD",credentials:"omit",signal:AbortSignal.any([signal,AbortSignal.timeout(4000)])});
      signal.throwIfAborted();
      if (response.ok && response.headers.get("content-type")?.startsWith("image/")) return url;
    } catch { signal.throwIfAborted(); }
  }
}
