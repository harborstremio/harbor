import { MODS_UI_ENABLED } from "@/lib/games/mods-availability";
import { MOD_GAMES, type ModGameId } from "@/lib/games/mod-workspace";
import { ModGameLogo, ModsIcon } from "./mod-workspace-parts";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, WandSparkles } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { DownloadSummary } from "@/lib/games/download-presentation";
import { GameNavigationIcon } from "./game-navigation-icons";
import { GameConsoleMark } from './game-console-mark';
import { ROM_PLATFORMS } from '@/lib/games/rom-discovery';
import { NavGlyph } from "@/components/icons/nav-glyph";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
import "./game-navigation.css";

export type GameDestination = "explore" | "roms" | "library" | "mods" | "saved" | "downloads";

export function GameNavigation({ tab, downloads, active = true, disabled = false, navigate, openHacks, openMods, openConsole, modGame, romHacks = false }: {
  romHacks?: boolean;
  openConsole?: (platform: typeof ROM_PLATFORMS[number], origin: HTMLButtonElement) => void;
  openMods?: (game: ModGameId | null) => void;
  modGame?: ModGameId | null;
  tab: GameDestination;
  downloads?: DownloadSummary;
  active?: boolean;
  disabled?: boolean;
  navigate: (tab: GameDestination) => void;
  openHacks: (origin: HTMLButtonElement) => void;
}) {
  const t = useT(), id = useId();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"roms" | "mods" | null>(null);
  const modsTrigger = useRef<HTMLButtonElement>(null);
  const anchor = open === "mods" ? modsTrigger : trigger;
  useLayoutEffect(() => {
    const mast = trigger.current?.closest<HTMLElement>(".games-mast"), browser = mast?.parentElement;
    if (!mast || !browser) return;
    const measure = () => {
      if (mast.offsetHeight) browser.style.setProperty("--games-navigation-height", `${mast.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(mast);
    return () => { observer.disconnect(); browser.style.removeProperty("--games-navigation-height"); };
  }, []);
  const close = (restore = false) => {
    setOpen(null);
    if (restore) anchor.current?.focus({ preventScroll: true });
  };
  useSectionBack(() => close(true), !!open && active, true);
  useEffect(() => { if (!active) setOpen(null); }, [active]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => (menu.current?.querySelector<HTMLButtonElement>('button[aria-current="page"]') ?? menu.current?.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll: true }));
    const onBack = (event: KeyboardEvent) => {
      if (!isBackKey(event)) return;
      event.preventDefault(); event.stopImmediatePropagation(); close(true);
    };
    window.addEventListener("keydown", onBack, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onBack, true); };
  }, [open]);
  const downloadCount = downloads?.total ?? 0;
  const downloadLabel = t("games.download.center.unfinished", { count: downloadCount });
  const downloadBreakdown = downloads ? ([
    [downloads.active, "games.download.filter.active"], [downloads.queued, "games.download.state.queued"],
    [downloads.paused, "games.download.state.paused"], [downloads.failed, "games.download.center.attention"],
  ] as const).filter(([count]) => count > 0).map(([count, label]) => `${t(label)}: ${count}`).join(" · ") : "";
  const item = (destination: GameDestination, label: string, icon: ReactNode) => {
    const showCount = destination === "downloads" && downloadCount > 0;
    const button = <button className="games-navigation-button" type="button" disabled={disabled} aria-current={tab === destination ? "page" : undefined} aria-label={showCount ? `${t(label)} · ${downloadLabel} · ${downloadBreakdown}` : undefined} onClick={() => navigate(destination)}>
      {icon}<span>{t(label)}</span>{showCount && <i className={`games-navigation-download-count${downloads?.active ? " is-active" : downloads?.failed ? " needs-attention" : ""}`} aria-hidden="true"><span key={downloadCount}>{downloadCount > 99 ? "99+" : downloadCount}</span></i>}
    </button>;
    return destination === "downloads" ? <HoverTooltip className="games-navigation-download" label={downloadLabel} sublabel={downloadBreakdown} disabled={!showCount}>{button}</HoverTooltip> : button;
  };
  return <nav className="games-navigation" aria-label={t("nav.games")}>
    {item("explore", "games.explore", <GameNavigationIcon name="explore"/>)}
    <button className="games-navigation-button" ref={trigger} type="button" disabled={disabled} aria-current={tab === "roms" ? "page" : undefined} aria-haspopup="menu" aria-expanded={open === "roms"} aria-controls={open === "roms" ? id : undefined} onClick={() => setOpen(value => value === "roms" ? null : "roms")}>{romHacks ? <WandSparkles size={22}/> : <GameNavigationIcon name="roms"/>}<span>{t(romHacks ? "games.hub.title" : "games.roms.title")}</span><ChevronDown className="games-navigation-chevron" size={16}/></button>
    {MODS_UI_ENABLED && <button className="games-navigation-button" ref={modsTrigger} type="button" disabled={disabled} aria-current={tab === "mods" ? "page" : undefined} aria-haspopup="menu" aria-expanded={open === "mods"} aria-controls={open === "mods" ? id : undefined} onClick={() => setOpen(value => value === "mods" ? null : "mods")}><ModsIcon/><span>{t("games.modHub.title")}</span><ChevronDown className="games-navigation-chevron" size={16}/></button>}
    {item("saved", "games.saved", <MusicGlyph name="heart" size={21}/>)}
    {item("downloads", "games.download.nav", <NavGlyph name="download"/>)}
    <AnchoredMenu anchorRef={anchor} open={!!open && active} onClose={() => close(!!menu.current?.contains(document.activeElement))} width={open==='roms'?300:240} backdrop={false}>
      <div id={id} ref={menu} role="menu" aria-label={t(open === "mods" ? "games.modHub.title" : "games.roms.title")} className="games-navigation-menu" onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== anchor.current) close();
      }} onKeyDown={event => {
        const dir = getDirection(event.nativeEvent);
        if (dir !== "up" && dir !== "down" && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault(); event.stopPropagation();
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (dir === "down" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus({ preventScroll: true });items[next]?.scrollIntoView({block:'nearest'});
      }}>
        {open === "mods" ? <><button type="button" role="menuitem" onClick={() => { close(true); openMods ? openMods(null) : navigate("mods"); }}><ModsIcon/><span>{t("games.modHub.allMods")}</span></button>{MOD_GAMES.map(game => <button type="button" role="menuitem" key={game.id} aria-current={tab === "mods" && modGame === game.id ? "page" : undefined} onClick={() => { close(true); openMods ? openMods(game.id) : navigate("mods"); }}><ModGameLogo game={game.id} compact decorative/><span>{game.name}</span></button>)}</> : <><button type="button" role="menuitem" aria-current={tab === "roms" && !romHacks ? "page" : undefined} onClick={() => { close(true); navigate("roms"); }}><GameNavigationIcon name="roms"/><span>{t("games.roms.title")}</span></button>
        <button type="button" role="menuitem" aria-current={tab === "roms" && romHacks ? "page" : undefined} onClick={() => { close(true); if (trigger.current) openHacks(trigger.current); }}><WandSparkles size={22}/><span>{t("games.hub.title")}</span></button>
        {openConsole&&<><div role="separator" className="games-navigation-divider"/><p className="games-navigation-label">{t('games.roms.pickConsole')}</p>{ROM_PLATFORMS.map(platform=><button type="button" role="menuitem" key={platform.id} onClick={()=>{close();if(trigger.current)openConsole(platform,trigger.current);}}><GameConsoleMark platform={platform}/><span>{platform.name}</span></button>)}</>}</>}
      </div>
    </AnchoredMenu>
  </nav>;
}
