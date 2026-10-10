import { launcherSessionBusy, launcherSessionLabel } from "@/lib/games/launcher-sessions";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { ArrowUpRight, Check, Library, Search, Settings2, X } from "lucide-react";
import { LAUNCHER_NAMES } from "@/lib/games/launchers";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useT } from "@/lib/i18n";
import { pushBackHandler } from "@/lib/back-intercept";
import { useSettings } from "@/lib/settings";
import { useQuickLibraryArtwork } from "@/hooks/use-quick-library-artwork";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { GamesIcon } from "@/components/icons/games-icon";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { MusicQuickStrip } from "@/components/music/music-quick-strip";
import { requestMusicLibrary, requestMusicSearch } from "@/lib/music/navigation";
import { useView } from "@/lib/view";
import { filterQuickLibrary, quickLibrary, type QuickFilters, type QuickGame } from "@/lib/games/quick-library";
import { useGameAccess } from "./game-access";
import { GameArt } from "./game-art";
import { SteamShortcutIcon } from "./game-steam-shortcut-icon";
import { customLaunchHealth } from "@/lib/games/custom-launch-health";
import "./game-library-dock.css";

const defaults: QuickFilters = { query: "", group: "all", source: "all", ready: false, sort: "recent" };
type DockMode = "games" | "music";
/** The chosen strip outlives a close, so reopening lands where the listener left it. */
let heldDockMode: DockMode = "games";
export function GameLibraryDock({ visible: pageVisible }: { visible: boolean }) {
  const access = useGameAccess(), t = useT();
  const { setView } = useView();
  const [mode, setDockMode] = useState<DockMode>(heldDockMode);
  const music = mode === "music";
  const setMode = (next: DockMode) => { heldDockMode = next; setDockMode(next); };
  const toMusic = (run: () => void) => { close(false); setView("music"); run(); };
  const { settings } = useSettings();
  const visible = pageVisible && settings.showQuickGameLibrary;
  const { library, shortcuts, launchers, libraryPreferences: prefs, customLibrary: custom, emulation, dockOpen, setDockOpen } = access;
  const [filters, setFilters] = useState(defaults), [options, setOptions] = useState(false);
  const [confirmed, setConfirmed] = useState<string|null>(null), [retained, setRetained] = useState(false);
  const pageFocus = useRef<HTMLElement|null>(null), pointerInside = useRef(false), restoringFocus = useRef(false), hoverTimer = useRef<number|null>(null), pointerOpened = useRef(false),
    origin = useRef<HTMLElement|null>(null), toggle = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), search = useRef<HTMLInputElement>(null);
  const games = quickLibrary(library.scan?.games ?? [], custom.data.games, emulation.data, access.saved, prefs.data, launchers.scan, {customHealth:custom.health,shortcuts:shortcuts.games});
  const shown = filterQuickLibrary(games, filters);
  const libraryArt = useQuickLibraryArtwork(shown, panel, visible && dockOpen && !music);
  const art = (game: QuickGame) => game.source === "custom" && game.custom.artwork && isTauri() ? convertFileSrc(game.custom.artwork) : prefs.icon(game.id,game.game) ?? prefs.cover(game.id,game.game) ?? libraryArt(game);
  const source = (game: QuickGame) => game.source === "steam" ? "Steam" : game.source === "launcher" ? LAUNCHER_NAMES[game.install.launcher] : t(`games.dock.${game.source}`);
  const status = (game: QuickGame) => t(game.source === "shortcut" ? `games.shortcuts.state.${game.shortcut.state}` : game.source === "custom" ? `games.launchHealth.${customLaunchHealth(game.custom,custom.health)?.state??(custom.checking?"checking":"unchecked")}` : game.source === "steam" ? `games.library.${game.install.state}` : game.source === "saved" ? "games.dock.saved" : game.ready ? "games.library.installed" : "games.dock.setup");
  const cancelHover = () => { if (hoverTimer.current !== null) clearTimeout(hoverTimer.current); hoverTimer.current = null; };
  const close = (restore = true) => { cancelHover(); setDockOpen(false); setOptions(false); if (restore) requestAnimationFrame(() => { restoringFocus.current = true; (origin.current?.isConnected ? origin.current : toggle.current)?.focus({ preventScroll: true }); requestAnimationFrame(() => { restoringFocus.current = false; }); }); };
  const show = (element: HTMLElement, hover = false) => { cancelHover(); pointerOpened.current = hover; if (!panel.current?.contains(document.activeElement)) pageFocus.current = document.activeElement as HTMLElement; origin.current = element; setOptions(false); setDockOpen(true); };
  useEffect(() => { setFilters(defaults); setOptions(false); }, [access.profile]);
  useEffect(() => { if (!visible) { cancelHover(); setDockOpen(false); } }, [visible, setDockOpen]);
  useEffect(() => {
    if (dockOpen && visible) { setRetained(true); return; }
    const timer = window.setTimeout(() => setRetained(false), 180);
    return () => clearTimeout(timer);
  }, [dockOpen, visible]);
  const closeOptions = () => { setOptions(false); requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(".game-dock-tools button[aria-expanded]")?.focus({ preventScroll: true })); };
  useEffect(() => {
    if (!visible || !dockOpen) return;
    return pushBackHandler(() => { if (options) closeOptions(); else close(); return true; });
  }, [visible, dockOpen, options]);
  useEffect(() => {
    if (!dockOpen || !visible || pointerOpened.current) return;
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>(".game-dock-library")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [dockOpen, visible]);
  useEffect(() => () => cancelHover(), []);
  useEffect(() => {
    if (!dockOpen) return;
    const outside = (event: PointerEvent) => { const target = event.target as HTMLElement; if (!panel.current?.contains(target) && !toggle.current?.contains(target) && !target.closest("[data-dropdown-menu]")) close(false); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [dockOpen]);
  const open = (game: QuickGame) => { close(false); if(game.source === "shortcut"){access.openShortcut(game.id,toggle.current??undefined);return;} access.navigate(game.game ? { game: {...game.game,libraryEntryId:game.id} } : { library: game.source === "retro" ? "retro" : "custom" }, pageFocus.current ?? undefined); };
  const favorite = async (game: QuickGame) => {
    const success = game.game ? await access.save(game.game) : game.source === "custom" ? await custom.update(game.custom.id, { pinned: !game.favorite }) : await prefs.update([game.id], { pinned: !game.favorite });
    if (success && !game.favorite) setConfirmed(game.id);
    if (success && game.favorite && filters.group === "favorites") panel.current?.querySelector<HTMLElement>(".game-dock-tools button[aria-pressed]")?.focus({ preventScroll: true });
  };
  const launch = (game: QuickGame) => { if (!game.ready) return; if (game.source === "steam") void library.launch(game.install.appId); else if (game.source === "shortcut") void shortcuts.launch(game.shortcut); else if (game.source === "custom") void custom.launch(game.custom); else if (game.source === "retro") void emulation.launch(game.local); else if (game.source === "launcher") void launchers.launch(game.install.id); };
  const busy = (game: QuickGame) => game.source === "shortcut" ? shortcuts.launching !== null || shortcuts.running.some(process => process.id === game.id) : game.source === "steam" ? library.launching !== null : game.source === "launcher" ? launchers.launching !== null || launcherSessionBusy(game.install) : game.source === "custom" ? custom.busy.includes(game.custom.id) || custom.running.some(p => p.id === game.custom.id) : game.source === "retro" ? !!emulation.busy || emulation.running.some(p => p.path === game.local.path) : false;
  const launched = (game: QuickGame) => game.source === "shortcut" ? shortcuts.launched === game.id || shortcuts.running.some(process => process.id === game.id) : game.source === "steam" ? library.launched === game.install.appId : game.source === "launcher" ? launchers.launched === game.install.id || game.install.activity?.state === "running" : game.source === "custom" ? custom.running.some(p => p.id === game.custom.id) : game.source === "retro" && emulation.running.some(p => p.path === game.local.path);
  const native = library.available;
  const error = prefs.error || shortcuts.error || custom.error || emulation.error || (library.launchError ? "games.library.launchError" : launchers.launchError ? "games.dock.launchError" : "");
  const displayed = dockOpen || retained ? shown : [];
  if (!visible) return null;
  return <aside className={`game-library-dock${dockOpen ? " is-open" : retained ? " is-closing" : ""}`} aria-label={t("games.dock.title")}
    onPointerEnter={event => { if (event.pointerType !== "mouse") return; pointerInside.current = true; cancelHover(); if (!dockOpen) hoverTimer.current = window.setTimeout(() => show(toggle.current!, true), 150); }}
    onPointerLeave={() => { pointerInside.current = false; cancelHover(); if (!options && !panel.current?.contains(document.activeElement)) hoverTimer.current = window.setTimeout(() => close(false), 420); }}
    onFocus={cancelHover} onBlur={event => { if (!pointerInside.current && !event.currentTarget.contains(event.relatedTarget as Node) && !options) { cancelHover(); hoverTimer.current = window.setTimeout(() => close(false), 420); } }}>
    <button ref={toggle} className="game-dock-edge" aria-label={t("games.dock.quick")} aria-expanded={dockOpen} aria-controls="game-quick-library" tabIndex={dockOpen ? -1 : 0} onFocus={() => { if (!dockOpen && !restoringFocus.current) show(toggle.current!); }} onClick={() => { if (!dockOpen) show(toggle.current!); }} />
    <section ref={panel} id="game-quick-library" className="game-quick-library" aria-label={t("games.dock.title")} hidden={!dockOpen && !retained} inert={!dockOpen}>
      <div className="game-dock-tools">
        <HoverTooltip label={t(music ? "music.quick.toGames" : "music.quick.toMusic")} align="end"><button className="game-dock-library" data-dock-mode={mode} aria-label={t(music ? "music.quick.toGames" : "music.quick.toMusic")} onClick={() => setMode(music ? "games" : "music")}><span key={mode} className="game-dock-mode-icon">{music ? <NavGlyph name="music" className="h-[25px] w-[25px]"/> : <GamesIcon size={24}/>}</span></button></HoverTooltip>
        <div>{music
          ? <><HoverTooltip label={t("music.quick.search")} align="end"><button aria-label={t("music.quick.search")} onClick={() => toMusic(() => requestMusicSearch(""))}><Search size={17}/></button></HoverTooltip><HoverTooltip label={t("music.quick.saved")} align="end"><button aria-label={t("music.quick.saved")} onClick={() => toMusic(() => requestMusicLibrary({ view: "liked" }))}><MusicGlyph name="heart" size={16}/></button></HoverTooltip></>
          : <><HoverTooltip label={t("games.dock.search")} align="end"><button aria-label={t("games.dock.search")} aria-expanded={options} onClick={() => { setOptions(!options); requestAnimationFrame(() => search.current?.focus()); }}><Search size={17}/></button></HoverTooltip><HoverTooltip label={t(filters.group === "favorites" ? "games.dock.all" : "games.dock.favorites")} align="end"><button aria-label={t("games.dock.favorites")} aria-pressed={filters.group === "favorites"} onClick={() => setFilters({ ...filters, group: filters.group === "favorites" ? "all" : "favorites" })}><MusicGlyph name={filters.group === "favorites" ? "heart-filled" : "heart"} size={16}/></button></HoverTooltip></>
        }</div>
      </div>
      <div key={mode} className="game-dock-list" data-dock-mode={mode} aria-label={t(music ? "music.quick.title" : "games.dock.title")}>
        {music ? <MusicQuickStrip onLeave={() => close(false)}/> : <>
        <div className="game-dock-row"><HoverTooltip label={t("games.dock.openLibrary")} align="end"><button className="game-dock-open music-quick-pin" aria-label={t("games.dock.openLibrary")} onClick={() => { close(false); access.navigate({ library: "steam" }, pageFocus.current ?? undefined); }}><Library size={23}/></button></HoverTooltip></div>
        {displayed.map(game => <div key={game.id} className="game-dock-row" data-quick-id={game.id}>
          <HoverTooltip label={game.name} sublabel={`${source(game)} · ${status(game)}`} mark={art(game) ? <GameArt className="game-dock-tooltip-art" src={art(game) ?? ""}/> : <GamesIcon size={32}/>} large align="end" delayMs={230}>
            <button className="game-dock-open" data-library-game={game.game?.id ?? game.id} aria-label={t("games.dock.details", { name: game.name })} onClick={() => open(game)}>{art(game) ? <GameArt src={art(game) ?? ""}/> : game.source === "shortcut" ? <SteamShortcutIcon game={game.shortcut} library={shortcuts} active={visible && dockOpen && !music}/> : <GamesIcon size={25}/>}</button>
          </HoverTooltip>
          <button className="game-dock-favorite" aria-label={t(game.favorite ? "games.dock.unfavoriteGame" : "games.dock.favoriteGame", { name: game.name })} aria-pressed={game.favorite} disabled={prefs.busy || custom.busy.includes(game.id.replace(/^custom:/, ""))} onClick={() => void favorite(game)}><MusicGlyph name={game.favorite ? "heart-filled" : "heart"} size={12} className={confirmed === game.id ? "is-confirmed" : ""} onAnimationEnd={() => setConfirmed(null)}/></button>
          {game.source==="custom"&&!game.ready&&native&&<button className="game-dock-play" aria-label={t("games.launchHealth.repairNamed",{name:game.name})} onClick={()=>{close(false);access.repairCustom(game.custom.id,toggle.current??undefined);}}><Settings2 size={14}/></button>}{game.ready && native && <button className="game-dock-play" title={game.source === "launcher" && launcherSessionLabel(game.install) ? t(launcherSessionLabel(game.install)!) : undefined} aria-label={game.source === "launcher" && game.install.launchMode === "client" ? t("games.dock.openClient", { name: game.name, launcher: LAUNCHER_NAMES[game.install.launcher] }) : t("games.library.playGame", { name: game.name })} disabled={busy(game)} onClick={() => launch(game)}>{launched(game) ? <Check size={15}/> : game.source === "launcher" && game.install.launchMode === "client" ? <ArrowUpRight size={15}/> : <Play size={13}/>}</button>}
        </div>)}
        {!displayed.length && <HoverTooltip label={t(games.length ? "games.noResults" : "games.dock.empty")} sublabel={t(games.length ? "games.dock.tryFilters" : "games.dock.emptyNote")} align="end"><button className="game-dock-empty" aria-label={t(games.length ? "games.catalog.reset" : "games.dock.openLibrary")} onClick={() => games.length ? setFilters(defaults) : access.navigate({ library: "steam" }, pageFocus.current ?? undefined)}><Library size={24}/></button></HoverTooltip>}
        </>}
      </div>
      {options && <div className="game-dock-options">
        <div className="game-dock-option-heading"><strong>{t("games.dock.filters")}</strong><button aria-label={t("common.close")} onClick={closeOptions}><X size={18}/></button></div>
        <label className="game-dock-search"><Search size={18}/><input ref={search} value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder={t("games.dock.search")} aria-label={t("games.dock.search")}/></label>
        <label><span>{t("games.dock.show")}</span><Dropdown value={filters.group} onChange={value => setFilters({ ...filters, group: value as QuickFilters["group"] })} ariaLabel={t("games.dock.show")} options={["all", "favorites", "recent"].map(value => ({ value, label: t(`games.dock.${value}`) }))}/></label>
        <label><span>{t("games.dock.source")}</span><Dropdown value={filters.source} onChange={value => setFilters({ ...filters, source: value as QuickFilters["source"] })} ariaLabel={t("games.dock.source")} options={["all", "steam", "shortcut", "launcher", "custom", "retro", "saved"].map(value => ({ value, label: value === "steam" ? "Steam" : t(`games.dock.${value}`) }))}/></label>
        <label><span>{t("games.dock.sort")}</span><Dropdown value={filters.sort} onChange={value => setFilters({ ...filters, sort: value as QuickFilters["sort"] })} ariaLabel={t("games.dock.sort")} options={[{ value: "recent", label: t("games.dock.recentSort") }, { value: "name", label: t("games.dock.nameSort") }]}/></label>
        <button className="game-dock-ready" aria-pressed={filters.ready} onClick={() => setFilters({ ...filters, ready: !filters.ready })}><span>{t("games.dock.readyOnly")}</span><span className="game-dock-check">{filters.ready && <Check size={16}/>}</span></button>
        <div className="game-dock-count" role="status">{t("games.dock.count", { count: shown.length })}<button onClick={() => setFilters(defaults)}>{t("games.catalog.reset")}</button></div>
      </div>}
      {error && <div className="game-dock-error" role="alert">{t(error)}<button aria-label={t("common.close")} onClick={() => { prefs.dismissError(); custom.dismissError(); emulation.dismissError(); library.dismissLaunchError(); launchers.dismissLaunchError(); }}><X size={16}/></button></div>}
    </section>
  </aside>;
}
