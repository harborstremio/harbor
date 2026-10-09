import type { ModGameId } from "@/lib/games/mod-workspace";
import "./mod-identity.css";

/** Original small game marks; readable without a label covering the artwork. */
export function ModGameMark({ game }: { game: ModGameId }) {
  const minecraft = game === "minecraft";
  return <span className={`mod-game-mark is-${game}`} role="img" aria-label={minecraft ? "Minecraft" : `The Sims ${game.slice(-1)}`} title={minecraft ? "Minecraft" : `The Sims ${game.slice(-1)}`}>
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">{minecraft ? <><path fill="#78b958" d="M3 3h26v26H3z"/><path fill="#97d16d" d="M3 3h13v6H9v7H3zM22 3h7v7h-7z"/><path fill="#173021" d="M7 10h6v6H7zm12 0h6v6h-6zm-6 6h6v4h4v7h-5v-4h-4v4H9v-7h4z"/></> : <><path fill="#57d465" d="m11 1 9 14-9 16-9-16Z"/><path fill="#b3ed70" d="m11 1-3 14H2Z"/><path fill="#239650" d="m11 31-3-16H2Zm0-30 3 14h6Z"/><path fill="#8bec73" d="m11 1 3 14h-6Z"/><path fill="#38b958" d="m11 31 3-16h6Z"/></>}</svg>
    {!minecraft && <b aria-hidden="true">{game.slice(-1)}</b>}
  </span>;
}

export function ModProviderLogo({ source, iconOnly = false }: { source: string; iconOnly?: boolean }) {
  const file = source === "Modrinth" ? "modrinth.svg" : source === "Mod The Sims" ? "mod-the-sims.png" : source === "CurseForge" ? "curseforge.svg" : null;
  return <span className={`mod-provider-logo${iconOnly ? " is-icon" : ""}`} title={source}>
    {file && <img src={`/games/mods/${file}`} alt={iconOnly ? source : ""} width={22} height={22} decoding="async"/>}{!iconOnly && <span>{source}</span>}
  </span>;
}

export function ModProjectIcon({ name, size = 22 }: { name: "about" | "changelog" | "gallery" | "versions"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "about" ? <><path d="M4 3.5h10l5 5v12H4zM14 3.5v5h5M8 12h7M8 16h5"/><path d="M8 7h2"/></> : name === "changelog" ? <><path d="M8 4h12M8 12h12M8 20h8M3 4v16"/><path d="m1.5 4 1.5 1.5L5.5 2M1.5 12l1.5 1.5L5.5 10"/><circle cx="3" cy="20" r="1.5" fill="currentColor" stroke="none"/></> : name === "gallery" ? <><path d="M6 3h15v15H6zM3 7H2v15h15v-1M6 15l5-5 4 4 2-2 4 4"/><circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/></> : <><path d="m12 2 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 15l9 5 9-5"/><path d="M12 12v8"/></>}
  </svg>;
}
