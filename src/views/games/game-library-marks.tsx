import { GameDestinationIcon } from '@/components/icons/game-destination-icon';
import { GameCollectionsIcon } from "@/components/icons/game-collections-icon";
import { LAUNCHER_NAMES, type GameLauncher } from "@/lib/games/launchers";
import { GameLauncherLogo } from "./game-launcher-logo";
import { MusicGlyph } from "@/components/icons/music-glyph";

type LibrarySource = "all" | "steam" | "shortcut" | "custom" | "retro" | "collections" | "mods" | "launcher" | "saved" | GameLauncher;

/** Library destinations share a compact, 24-unit silhouette and inherit selection contrast. */
export function LibrarySourceMark({ source, size = 20 }: { source: LibrarySource; size?: number }) {
  if (source in LAUNCHER_NAMES) return <GameLauncherLogo launcher={source} size={size}/>;
  if (source === "all" || source === "mods" || source === "retro") return <GameDestinationIcon name={source === "retro" ? "roms" : source} size={size}/>;
  if (source === "collections") return <GameCollectionsIcon size={size} />;
  if (source === "saved") return <MusicGlyph name="heart" size={size}/>;
  if (source === "steam" || source === "shortcut") return <span aria-hidden="true" style={{
    display: "inline-block", width: size, height: size, flex: `0 0 ${size}px`,
    backgroundColor: "currentColor", mask: "url(/games/brands/steam.svg) center / contain no-repeat",
  }} />;

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: `0 0 ${size}px` }}>
    {source === "launcher" && <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 18h7m-3.5-3.5v7"/></>}
    {source === "custom" && <>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M9 20h6m-3-3.5V20M8 8v5m-2.5-2.5h5" />
      <circle cx="16" cy="9" r=".9" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r=".9" fill="currentColor" stroke="none" />
    </>}
  </svg>;
}
