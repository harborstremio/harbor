import { useState, type ReactNode } from "react";
import { GameDestinationIcon } from '@/components/icons/game-destination-icon';
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { MOD_GAMES, type ModDiscoveryProject, type ModGameId } from "@/lib/games/mod-workspace";
import { ModStats } from "./mod-stats";
import { ModGameMark, ModProviderLogo } from "./mod-identity";
import "./mod-workspace-parts.css";

/** Original module mark, shared with the sidebar and Games navigation. */
export function ModsIcon({ name = "mods", size = 22 }: { name?: "mods" | "browse" | "library" | "tools"; size?: number }) {
  if (name === 'mods') return <GameDestinationIcon name="mods" size={size}/>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "browse" ? <><rect x="3.5" y="4" width="7" height="7" rx="1"/><path d="M14 4h6.5v7H14zM3.5 15h7v5h-7zM14 15h6.5v5H14z"/></> : name === "library" ? <><path d="M4 6h16v14H4zM7 3.5h10M8 10v6m4-6v6m4-6v6"/></> : <><path d="m5 4 3 3-2 2-3-3v4l4 2 9 9 4-4-9-9V4l-4-1"/><path d="m15 5 4-2 2 2-2 4-4 3m-6 3-5 5"/></>}
  </svg>;
}
export function ModGameLogo({ game, compact = false, decorative = false }: { game: ModGameId; compact?: boolean; decorative?: boolean }) {
  const entry = MOD_GAMES.find(value => value.id === game)!;
  return <span aria-hidden={decorative||undefined} className={`mods-game-logo is-${game}${entry.lightLogo ? " has-light-plate" : ""}${compact ? " is-compact" : ""}`}><img src={entry.logo} alt={decorative?'':entry.name} decoding="async"/></span>;
}
export function ModImage({ src, eager = false, className = "" }: { src: string; eager?: boolean; className?: string }) {
  const [loaded, setLoaded] = useState(""), [failed, setFailed] = useState("");
  return <span className={`mods-image ${className}`} aria-hidden="true">{src && failed !== src ? <>{loaded !== src && <LoaderCircle className="mods-image-spinner" size={22}/>}<img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onLoad={() => setLoaded(src)} onError={() => setFailed(src)} className={loaded === src ? "is-loaded" : ""}/></> : <ModsIcon size={38}/>}</span>;
}
export function ModProjectCard({ project, open }: { project: ModDiscoveryProject; open: (project: ModDiscoveryProject, origin: HTMLButtonElement) => void }) {
  return <button className="mods-project-card" onClick={event => open(project, event.currentTarget)} aria-label={project.title}>
    <span className="mods-card-image"><ModImage src={project.image}/></span><span className="mods-project-card-copy"><strong dir="auto">{project.title}</strong><small dir="auto">{project.author}</small><span dir="auto">{project.description}</span><span className="mods-project-card-meta"><ModGameMark game={project.route.game}/><ModStats values={project.metrics} compact/><ModProviderLogo source={project.source} iconOnly/></span></span>
  </button>;
}
export function ModsTabs({ children, label }: { children: ReactNode; label: string }) { return <nav className="mods-tabs" aria-label={label}>{children}</nav>; }

export function ModProjectSpotlight({ project, label, open }: { project: ModDiscoveryProject; label: string; open: (origin: HTMLButtonElement) => void }) {
  const t = useT();
  return <section className="mods-catalog-spotlight"><ModImage src={project.image} eager/><div><span className="mod-source-badge">{label}</span><h3 dir="auto">{project.title}</h3><small dir="auto">{project.author}</small>{project.description && <p dir="auto">{project.description}</p>}<ModStats values={project.metrics} compact/></div><button className="games-button games-button-primary" onClick={event => open(event.currentTarget)}>{t("games.modHub.viewProject")}<ArrowRight size={17}/></button></section>;
}
