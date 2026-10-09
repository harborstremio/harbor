type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

/** The SteamCMD mirror exposes Valve's current hashed library-logo path. */
export function steamLibraryLogo(value: unknown, appId: number): string | undefined {
  if (!Number.isSafeInteger(appId) || appId <= 0) return;
  const root = row(value), app = row(row(root.data)[String(appId)]), common = row(app.common);
  if (root.status !== "success" || String(app.appid) !== String(appId) || String(common.gameid) !== String(appId) || String(common.type).toLowerCase() !== "game") return;
  const logo = row(row(common.library_assets_full).library_logo);
  const file = row(logo.image2x).english ?? row(logo.image).english;
  if (typeof file !== "string" || !/^(?:[a-f0-9]{40}\/)?(?:library_)?logo(?:_2x)?\.png$/i.test(file)) return;
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${file}`;
}

export const RETRO_LOGO_FOLDERS: Readonly<Record<number, string>> = {
  18: "Nintendo - Nintendo Entertainment System",
  19: "Nintendo - Super Nintendo Entertainment System",
  4: "Nintendo - Nintendo 64",
  33: "Nintendo - Game Boy",
  22: "Nintendo - Game Boy Color",
  24: "Nintendo - Game Boy Advance",
  20: "Nintendo - Nintendo DS",
  21: "Nintendo - GameCube",
  5: "Nintendo - Wii",
  7: "Sony - PlayStation",
  38: "Sony - PlayStation Portable",
  29: "Sega - Mega Drive - Genesis",
  64: "Sega - Master System - Mark III",
  35: "Sega - Game Gear",
  32: "Sega - Saturn",
  23: "Sega - Dreamcast",
};
export type RetroLogoIndex = Record<string, Record<string, string>>;

// Normalize spelling and No-Intro's moved article; never fuzzy-match a sequel,
// remake, collection or hack to a different game.
export function heroLogoTitleKey(title: string): string {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/,\s*(the|a|an)(?=\s*(?:-|:|$))/g, "")
    .replace(/^(?:the|a|an)\s+/, "").replace(/[^a-z0-9]/g, "")
    .replace(/^(pokemon.+)version$/, "$1");
}

export function indexRetroLogoFiles(files: string[]): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  const rank = (name: string) => /\((?:[^)]*, )?USA(?:,|\))/.test(name) ? 0 : /\((?:Europe|World)(?:,|\))/.test(name) ? 1 : 2;
  for (const file of [...files].sort((a,b) => rank(a)-rank(b) || a.length-b.length || a.localeCompare(b))) {
    if (file.length > 300 || /[/\\<>\x00-\x1f]/.test(file) || !file.endsWith(".png") || /\((?:[^)]*\b(?:Beta|Proto|Sample|Demo|Hack|Aftermarket|Unl)\b)/i.test(file)) continue;
    const title = file.replace(/(?:\s*\([^)]*\))+\.png$/, "");
    if (title === file) continue;
    const key = heroLogoTitleKey(title);
    if (key && !Object.hasOwn(result, key)) result[key] = file;
  }
  return result;
}

export function retroHeroLogos(index: RetroLogoIndex, names: readonly string[], platformIds: readonly number[], gameType?: number): string[] {
  if (gameType !== undefined && ![0, 8, 9, 10, 11].includes(gameType)) return [];
  const result: string[] = [];
  for (const platform of platformIds) {
    const folder = RETRO_LOGO_FOLDERS[platform], files = index[platform];
    if (!folder || !files) continue;
    for (const name of names) {
      const key = heroLogoTitleKey(name), file = Object.hasOwn(files, key) ? files[key] : undefined;
      if (file) result.push(`https://thumbnails.libretro.com/${encodeURIComponent(folder)}/Named_Logos/${encodeURIComponent(file)}`);
    }
  }
  return [...new Set(result)].slice(0, 4);
}
