import { MODS_UI_ENABLED } from "@/lib/games/mods-availability";
import { GameNotesDialog } from "./game-notes-launcher";
import { gameVideoSearchUrl } from "@/lib/games/video-search";
import { launcherSessionBusy } from "@/lib/games/launcher-sessions";
import { Play } from "@/components/icons/play-filled";
import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUp, ArrowUpRight, ArrowDownAZ, Check, ChevronDown, Clock3, Eye, EyeOff, GripVertical, Library, Pin, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Dropdown } from "@/components/dropdown";
import { LAUNCHER_NAMES } from "@/lib/games/launchers";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { useSettings } from "@/lib/settings";
import { activeLayout } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { useQuickLibraryArtwork } from "@/hooks/use-quick-library-artwork";
import { useGameSidebarPreferences } from "@/hooks/use-game-sidebar-preferences";
import { defaultSidebarPreferences, moveSidebarGame, sidebarGames, sidebarSections } from "@/lib/games/sidebar-preferences";
import { LIBRARY_BADGES, quickGameBadge, setLibraryBadge, useLibraryBadges } from "@/lib/games/library-badges";
import { quickLibrary, type QuickGame } from "@/lib/games/quick-library";
import type { GameSummary } from "@/lib/games/types";
import { useGameAccess, type LibraryDestination } from "./game-access";
import { GameHarborMenu } from "./game-harbor-menu";
import { GameNavigationIcon } from "./game-navigation-icons";
import { GameArt } from "./game-art";
import { SteamShortcutIcon } from "./game-steam-shortcut-icon";
import { LibrarySourceMark } from "./game-library-marks";
import { GameSidebarTooltipDetails } from "./game-sidebar-tooltip";
import { GameLibrarySidebarRowsSkeleton } from "./game-library-sidebar-loading";
import { GameSkeleton } from "./game-loading";
import { GameLibraryContextMenu, type LibraryMenuTarget } from "./game-library-context-menu";
import { managementCommand, managementFile, type LibraryAction } from "@/lib/games/library-management";
import { osClass } from "@/lib/platform";
import "./game-library-sidebar.css";

export function GameLibrarySidebar({ active, query, setQuery, mode, setMode, selected, open, home, explore, destination, harborNavigationOpen, onHarborNavigationChange }: {
  active: boolean; query: string; setQuery: (value: string) => void; mode: LibraryDestination; setMode: (value: LibraryDestination) => void;
  selected?: string; open: (game: GameSummary, origin?: HTMLElement) => void; home: () => void; explore: () => void;
  destination: string; harborNavigationOpen: boolean; onHarborNavigationChange?: (open: boolean) => void;
}) {
  const t = useT(), access = useGameAccess(), { library, shortcuts, launchers, libraryPreferences: prefs, customLibrary: custom, emulation } = access;
  const { settings, update } = useSettings();
  const preview = useThemePreview();
  const layout = preview?.layout ?? activeLayout(settings.theme);
  const sharedSidebar = ["sidebar", "nord", "dracula", "forest", "rail"].includes(layout);
  const sideNavigation = sharedSidebar || layout === "stremio";
  const [compact, setCompact] = useState(() => innerWidth < 1024);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(() => innerWidth < 850), [options, setOptions] = useState(false);
  const compactSidebar = sharedSidebar && layout !== "rail" && compact;
  const collapsed = sharedSidebar ? compactSidebar ? !compactExpanded : settings.sidebarCollapsed : libraryCollapsed;
  const setCollapsed = (value: boolean) => { if (compactSidebar) setCompactExpanded(!value); else if (sharedSidebar) update({ sidebarCollapsed: value }); else setLibraryCollapsed(value); };
  const concealed = harborNavigationOpen && sideNavigation;
  // The shell reads this instead of :has(.games-library-sidebar.is-collapsed). A :has()
  // on the shell is re-evaluated on every DOM insert or removal beneath it, and the games
  // views mount and unmount thousands of nodes while scrolling.
  useEffect(() => {
    const shell = sidebar.current?.closest<HTMLElement>("[data-harbor-shell]");
    if (!shell) return;
    shell.toggleAttribute("data-games-sidebar-collapsed", collapsed);
    return () => shell.removeAttribute("data-games-sidebar-collapsed");
  }, [collapsed]);

  const badges = useLibraryBadges();
  const preferences = useGameSidebarPreferences(access.profile), { filters } = preferences.value;
  const setFilters = (value: typeof filters) => preferences.update(current => ({ ...current, filters: value }));
  const [editing, setEditing] = useState(false), [dragging, setDragging] = useState<string | null>(null), [dropTarget, setDropTarget] = useState<string | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; target?: string } | null>(null);
  const arrangeButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), filterButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [notebook, setNotebook] = useState<{ profile: string; id: string; name: string } | null>(null);
  useEffect(() => setNotebook(null), [access.profile, active]);
  const [context, setContext] = useState<(LibraryMenuTarget & { profile: string }) | null>(null);
  const contextOrigin = useRef<HTMLElement | null>(null);
  const contextReturnFocus = useRef(true);
  const closeContext = useCallback(() => {
    setContext(null);
    requestAnimationFrame(() => {
      if (!contextReturnFocus.current) return;
      const origin = contextOrigin.current;
      if (origin?.isConnected && origin.getClientRects().length) origin.focus({ preventScroll: true });
      else input.current?.focus({ preventScroll: true });
    });
  }, []);
  const showContext = (game: QuickGame, origin: HTMLElement, x?: number, y?: number) => {
    if (editing || !active || concealed) return;
    const box = origin.getBoundingClientRect();
    contextOrigin.current = origin; contextReturnFocus.current = true; setOptions(false);
    setContext({ game, origin, x: x ?? box.right, y: y ?? box.top, profile: access.profile });
  };
  const games = quickLibrary(library.scan?.games ?? [], custom.data.games, emulation.data, access.saved, prefs.data, launchers.scan, {customHealth:custom.health,shortcuts:shortcuts.games});
  const shown = sidebarGames(games, preferences.value, query, editing);
  const sections = sidebarSections(shown, preferences.value, editing);
  // A null scan is pending even before its effect starts; completed/cached scans stay visible.
  const loading = !shown.length && [{ state: library, source: "steam" }, { state: shortcuts, source: "shortcut" }, { state: launchers, source: "launcher" }]
    .some(({ state, source }) => (editing || filters.source === "all" || filters.source === source) && state.available && !state.scan && (!state.error || state.loading));
  const libraryArt = useQuickLibraryArtwork(shown, list, active && !concealed);
  const closeOptions = () => { setOptions(false); requestAnimationFrame(() => filterButton.current?.focus({ preventScroll: true })); };
  useSectionBack(() => setCollapsed(true), active && !harborNavigationOpen && !collapsed && innerWidth <= 600, true);
  useSectionBack(closeOptions, active && options, true);
  const finishEditing = () => { setEditing(false); setOptions(true); requestAnimationFrame(() => arrangeButton.current?.focus({ preventScroll: true })); };
  useSectionBack(finishEditing, active && editing, true);
  useEffect(() => {
    if (collapsed || harborNavigationOpen) return;
    const outside = (event: PointerEvent) => { const target = event.target as HTMLElement; if (innerWidth <= 600 && !sidebar.current?.contains(target) && !target.closest("[data-dropdown-menu], [role=dialog]")) { setOptions(false); setCollapsed(true); } };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [collapsed, harborNavigationOpen]);
  useEffect(() => { if (!active) { setOptions(false); setEditing(false); } }, [active]);
  useEffect(() => { if (collapsed || harborNavigationOpen) setEditing(false); }, [collapsed, harborNavigationOpen]);
  useEffect(() => { if (!editing) { drag.current = null; setDragging(null); setDropTarget(null); } }, [editing]);
  useEffect(() => {
    const small = matchMedia("(max-width: 1023px)");
    const resize = () => { setCompact(small.matches); setCompactExpanded(false); if (innerWidth < 850) setLibraryCollapsed(true); };
    small.addEventListener("change", resize);
    return () => small.removeEventListener("change", resize);
  }, []);
  useEffect(() => { setEditing(false); setOptions(false); }, [access.profile]);
  useEffect(() => { setContext(null); }, [access.profile, active, collapsed, harborNavigationOpen]);
  useEffect(() => { if (selected) list.current?.querySelector<HTMLElement>(`[data-library-game="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" }); }, [selected]);
  const art = (game: QuickGame) => game.source === "custom" && game.custom.artwork && isTauri() ? convertFileSrc(game.custom.artwork) : prefs.icon(game.id,game.game) ?? prefs.cover(game.id,game.game) ?? libraryArt(game);
  const source = (game: QuickGame) => game.source === "steam" ? "Steam" : game.source === "launcher" ? LAUNCHER_NAMES[game.install.launcher] : t(`games.dock.${game.source}`);
  const launch = (game: QuickGame) => { if (!game.ready) return; if (game.source === "steam") void library.launch(game.install.appId); else if (game.source === "shortcut") void shortcuts.launch(game.shortcut); else if (game.source === "custom") void custom.launch(game.custom); else if (game.source === "retro") void emulation.launch(game.local); else if (game.source === "launcher") void launchers.launch(game.install.id); };
  const busy = (game: QuickGame) => game.source === "shortcut" ? shortcuts.launching !== null || shortcuts.running.some(process => process.id === game.id) : game.source === "steam" ? library.launching !== null : game.source === "launcher" ? launchers.launching !== null || launcherSessionBusy(game.install) : game.source === "custom" ? custom.busy.includes(game.custom.id) || custom.running.some(p => p.id === game.custom.id) : game.source === "retro" && (!!emulation.busy || emulation.running.some(p => p.path === game.local.path));
  const badge = (game: QuickGame) => { const found = quickGameBadge(game); return found && badges[found.badge] ? found : null; };
  const favorite = async (game: QuickGame) => {
    const success = game.game ? await access.save(game.game) : game.source === "custom" ? await custom.update(game.custom.id, { pinned: !game.favorite }) : await prefs.update([game.id], { pinned: !game.favorite });
    if (success && game.favorite && filters.group === "favorites") sidebar.current?.querySelector<HTMLButtonElement>(".games-library-side-filters button")?.focus({ preventScroll: true });
    return success;
  };
  const choose = (game: QuickGame, origin: HTMLElement) => { if (game.source === "shortcut") access.openShortcut(game.id, origin); else if (game.game) open({...game.game,libraryEntryId:game.id}, origin); else { setMode(game.source === "retro" ? "retro" : "custom"); setQuery(game.name); } };
  const pinned = (game: QuickGame) => preferences.value.pinned.includes(game.id);
  const pinnedGames = shown.filter(pinned), otherGames = shown.filter(game => !pinned(game));
  const positions = new Map([...pinnedGames.map((game, index) => [game.id, index] as const), ...otherGames.map((game, index) => [game.id, index] as const)]);
  const move = (id: string, target: string) => {
    preferences.update(current => moveSidebarGame(current, games, id, target));
    requestAnimationFrame(() => {
      const button = list.current?.querySelector<HTMLButtonElement>(`[data-sidebar-id="${CSS.escape(id)}"] .games-library-side-game`);
      button?.focus({ preventScroll: true }); button?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  };
  const toggle = (key: "pinned" | "hidden" | "collapsedGroups", id: string) => preferences.update(current => ({ ...current, [key]: current[key].includes(id) ? current[key].filter(item => item !== id) : [...current[key], id] }));
  const running = (game: QuickGame) => game.source === "shortcut" ? shortcuts.running.some(process => process.id === game.id) : game.source === "custom" ? custom.running.some(process => process.id === game.custom.id)
    : game.source === "retro" && (emulation.running.some(process => process.path === game.local.path) || emulation.session?.path === game.local.path);
  const contextGame = context && games.find(game => game.id === context.game.id);
  const manageGame = async (action: LibraryAction) => {
    if (!context || context.profile !== access.profile) throw Error("game_changed");
    const game = games.find(game => game.id === context.game.id);
    if (!game) throw Error("game_changed");
    if (action === "notes") { setNotebook({ profile: access.profile, id: game.id, name: game.name }); return; }
    if (action === "play") { launch(game); return; }
    if (action === "favorite") { if (!await favorite(game)) throw Error("save_failed"); return; }
    if (action === "pin" || action === "hide") { toggle(action === "pin" ? "pinned" : "hidden", game.id); return; }
    if (action === "details") { contextReturnFocus.current = false; choose(game, context.origin); return; }
    if (action === "remove" && game.source === "custom") { if (!await custom.remove(game.custom.id)) throw Error("remove_failed"); return; }
    if (action === "properties" && game.source === "custom") { contextReturnFocus.current = false; access.repairCustom(game.custom.id, context.origin); return; }
    if (action === "properties" && game.source === "shortcut") { contextReturnFocus.current = false; access.openShortcut(game.id, context.origin); return; }
    if (action === "desktop" && game.source === "custom") { await invoke("games_game_shortcuts", { id: game.custom.id, name: game.name, config: game.custom.config, target: "desktop" }); return; }
    if (action === "gameplay" || action === "trailer") {
      const url = gameVideoSearchUrl(game.name, action); if (!url) throw Error("game_changed");
      if (isTauri()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); }
      else window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "browse" || action === "properties" || action === "uninstall") {
      const command = managementCommand(game, action);
      if (command) { await invoke(command.command, command.args); return; }
      if (action === "browse") {
        const path = managementFile(game); if (!path) throw Error("game_changed");
        const { revealItemInDir } = await import("@tauri-apps/plugin-opener"); await revealItemInDir(path); return;
      }
      if (action === "uninstall" && osClass() === "windows" && ["custom", "shortcut"].includes(game.source)) { await invoke("games_open_installed_apps"); return; }
    }
    throw Error("game_management_unsupported");
  };
  return <aside ref={sidebar} data-concealed={concealed || undefined} aria-hidden={concealed || undefined} inert={concealed || undefined} className={`games-library-sidebar${collapsed ? " is-collapsed" : ""}`} aria-label={t("games.dock.title")}>
    <header>
      <GameHarborMenu active={active} open={harborNavigationOpen} setOpen={onHarborNavigationChange}/>
      <HoverTooltip label={t(collapsed ? "games.sidebar.expand" : "games.sidebar.collapse")} side="bottom">
        <button className="games-library-collapse" aria-label={t(collapsed ? "games.sidebar.expand" : "games.sidebar.collapse")} aria-expanded={!collapsed} onClick={() => { setOptions(false); setCollapsed(!collapsed); }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4.5H5.5A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5H9M9 4.5v15M14 4.5h4.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H14"/>
            <path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"}/>
          </svg>
        </button>
      </HoverTooltip>
    </header>
    <nav className="games-library-destinations" aria-label={t("games.dock.openLibrary")}>
      <HoverTooltip label={t("games.dock.openLibrary")}><button aria-label={t("games.dock.openLibrary")} aria-current={destination === "library" && !selected ? "page" : undefined} onClick={home}><Library size={21}/><span>{t("games.library")}</span></button></HoverTooltip>
      <HoverTooltip label={t("games.explore")}><button aria-label={t("games.explore")} aria-current={destination === "explore" && !selected ? "page" : undefined} onClick={explore}><GameNavigationIcon name="explore"/><span>{t("games.explore")}</span></button></HoverTooltip>
    </nav>
    <div className="games-library-side-controls">
      {!collapsed && <Dropdown className="games-library-section" menuClassName="games-library-section-menu" value={mode} onChange={value => setMode(value as LibraryDestination)} ariaLabel={t("games.sidebar.shelf")} options={[
        { value: "all", label: t("games.sidebar.allGames"), left: <LibrarySourceMark source="all" /> },
        { value: "steam", label: "Steam", left: <LibrarySourceMark source="steam" /> },
        { value: "custom", label: t("games.custom.nav"), left: <LibrarySourceMark source="custom" /> },
        { value: "retro", label: t("games.emulation.library"), left: <LibrarySourceMark source="retro" /> },
        { value: "collections", label: t("games.collections.title"), left: <LibrarySourceMark source="collections" /> },
        ...(MODS_UI_ENABLED ? [{ value: "mods", label: t("games.mods.nav"), left: <LibrarySourceMark source="mods" /> }] : []),
      ]}/>}
      <div className="games-library-side-search"><Search size={17}/>{!collapsed && <input ref={input} aria-label={t("games.dock.search")} placeholder={t("games.dock.search")} value={query} onChange={event => setQuery(event.target.value)}/>} {collapsed ? <button aria-label={t("games.dock.search")} onClick={() => { setCollapsed(false); requestAnimationFrame(() => input.current?.focus()); }}/> : query && <button aria-label={t("games.clear")} onClick={() => setQuery("")}><X size={15}/></button>}</div>
      {!collapsed && <div className="games-library-side-filters"><HoverTooltip label={t("games.dock.favorites")}><button aria-label={t("games.dock.favorites")} aria-pressed={filters.group === "favorites"} onClick={() => setFilters({ ...filters, group: filters.group === "favorites" ? "all" : "favorites" })}><MusicGlyph name={filters.group === "favorites" ? "heart-filled" : "heart"} size={17}/></button></HoverTooltip><HoverTooltip label={t("games.dock.readyOnly")}><button aria-label={t("games.dock.readyOnly")} aria-pressed={filters.ready} onClick={() => setFilters({ ...filters, ready: !filters.ready })}><Check size={18}/></button></HoverTooltip><span role="status">{loading ? <GameSkeleton className="games-library-skeleton-count"/> : t("games.dock.count", { count: shown.length })}</span><HoverTooltip label={t("games.dock.filters")} align="end"><button ref={filterButton} aria-label={t("games.dock.filters")} aria-expanded={options} onClick={() => setOptions(!options)}><SlidersHorizontal size={17}/></button></HoverTooltip></div>}
      {!collapsed && <div className="games-library-side-drawer" data-open={options} aria-hidden={!options} inert={!options || undefined}><div className="games-library-side-clip"><div className="games-library-side-options"><Dropdown value={filters.source} onChange={value => setFilters({ ...filters, source: value as typeof filters.source })} ariaLabel={t("games.dock.source")} options={(["all", "steam", "shortcut", "launcher", "custom", "retro", "saved"] as const).map(value => ({ value, label: value === "steam" ? "Steam" : t(`games.dock.${value}`), left: <LibrarySourceMark source={value} size={18}/> }))}/><Dropdown value={filters.sort} onChange={value => setFilters({ ...filters, sort: value as typeof filters.sort })} ariaLabel={t("games.dock.sort")} options={[{ value: "recent", label: t("games.dock.recentSort"), left: <Clock3 size={18}/> }, { value: "name", label: t("games.dock.nameSort"), left: <ArrowDownAZ size={18}/> }, { value: "custom", label: t("games.sidebar.customOrder"), left: <GripVertical size={18}/> }]}/>
        <Dropdown value={preferences.value.grouping} onChange={value => preferences.update(current => ({ ...current, grouping: value as "source" | "none" }))} ariaLabel={t("games.sidebar.groupBy")} options={[{ value: "source", label: t("games.dock.source"), left: <LibrarySourceMark source="launcher" size={18}/> }, { value: "none", label: t("games.sidebar.allGames"), left: <LibrarySourceMark source="all" size={18}/> }]}/>
        <details className="games-library-badge-choices"><summary>{t("games.badge.shown")}</summary>
          {LIBRARY_BADGES.map(badge => <label key={badge}><input type="checkbox" checked={badges[badge]} onChange={event => setLibraryBadge(badge, event.target.checked)}/><span>{t(`games.badge.${badge}`)}</span></label>)}
        </details>
        <button ref={arrangeButton} className="games-library-arrange-open" onClick={() => { setEditing(true); setOptions(false); setQuery(""); requestAnimationFrame(() => { if (list.current) list.current.scrollTop = 0; list.current?.querySelector<HTMLButtonElement>("[data-library-game]")?.focus({ preventScroll: true }); }); }}><Settings2 size={17}/>{t("games.sidebar.arrange")}</button>
        <button className="games-library-reset" onClick={() => { setQuery(""); preferences.update(current => ({ ...current, filters: defaultSidebarPreferences().filters })); }}>{t("games.sidebar.resetFilters")}</button>
      </div></div></div>}
      {editing && <div className="games-library-arrange-heading"><span>{t("games.sidebar.arrange")}</span><button onClick={finishEditing}>{t("common.done")}</button><p>{t("games.sidebar.arrangeNote")}</p></div>}
      {preferences.error && <p role="alert" className="games-library-side-empty">{t("games.sidebar.saveFailed")}</p>}
    </div>
    <div ref={list} className="games-library-side-list" data-loading={loading || undefined} aria-busy={loading || undefined} data-local-keyboard onKeyDown={event => {
      if (editing && event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        const id = (event.target as HTMLElement).closest<HTMLElement>("[data-sidebar-id]")?.dataset.sidebarId;
        const group = shown.filter(game => preferences.value.pinned.includes(game.id) === preferences.value.pinned.includes(id ?? ""));
        const index = group.findIndex(game => game.id === id), target = group[index + (event.key === "ArrowDown" ? 1 : -1)];
        event.preventDefault(); event.stopPropagation(); if (id && target) move(id, target.id); return;
      }
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        const forward = event.key === (document.documentElement.dir === "rtl" ? "ArrowLeft" : "ArrowRight");
        const workspace = sidebar.current?.parentElement;
        const target = forward ? workspace?.querySelector<HTMLElement>('.games-detail .games-detail-actions button:not([disabled]), .games-browser:not([hidden]) .games-mast nav button[aria-current="page"]') : filterButton.current ?? sidebar.current?.querySelector<HTMLElement>(".games-library-destinations button");
        if (target) { event.preventDefault(); event.stopPropagation(); target.focus({ preventScroll: true }); }
        return;
      }
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || !(event.target as HTMLElement).hasAttribute("data-library-game")) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-library-game]")], index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      event.preventDefault(); event.stopPropagation(); buttons[next]?.focus();
    }}>
      {loading && <GameLibrarySidebarRowsSkeleton/>}
      {sections.map(section => { const expanded = collapsed || editing || !!query.trim() || !preferences.value.collapsedGroups.includes(section.id);
        const label = section.translated ? t(section.label) : section.label;
        const firstGame = section.games[0];
        const sectionSource = section.id === "all" ? "all" : firstGame.source === "launcher" ? firstGame.install.launcher : firstGame.source;
        return <section key={section.id} className="games-library-side-section">
        {!collapsed && <button className="games-library-side-group" aria-expanded={expanded} disabled={editing || !!query.trim()} onClick={() => toggle("collapsedGroups", section.id)}>{section.id === "pinned" ? <Pin size={16} aria-hidden="true"/> : section.id === "recent" ? <Clock3 size={16} aria-hidden="true"/> : <LibrarySourceMark source={sectionSource} size={16}/>}<span>{label}</span><small>({section.games.length})</small><ChevronDown size={13}/></button>}
        {expanded && section.games.map(game => { const mark = badge(game), isPinned = pinned(game), hidden = preferences.value.hidden.includes(game.id);
        const group = isPinned ? pinnedGames : otherGames, position = positions.get(game.id)!;
        return <div key={game.id} data-sidebar-id={game.id}>
        <div className="games-library-side-row" data-selected={selected === game.game?.id} data-editing={editing || undefined} data-hidden={hidden || undefined} data-dragging={dragging === game.id || undefined} data-drop={dropTarget === game.id || undefined}
          onContextMenu={event => { if (editing) return; event.preventDefault(); event.stopPropagation(); const origin = event.currentTarget.querySelector<HTMLElement>("[data-library-game]"); if (origin) showContext(game, origin, event.clientX || undefined, event.clientY || undefined); }}
          onKeyDown={event => { if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") { event.preventDefault(); event.stopPropagation(); const origin = event.currentTarget.querySelector<HTMLElement>("[data-library-game]"); if (origin) showContext(game, origin); } }}>
          <HoverTooltip label={game.name} disabled={editing || !active || concealed} delayMs={430} tooltipClassName="games-sidebar-tooltip" details={<GameSidebarTooltipDetails game={game} source={source(game)} running={running(game)} health={custom.health}/>} mark={art(game) ? <GameArt className="game-dock-tooltip-art" src={art(game) ?? ""}/> : undefined} large><button className="games-library-side-game" data-library-game={game.game?.id ?? game.id} data-tone={quickGameBadge(game)?.tone} aria-label={t("games.dock.details", { name: game.name })} aria-current={selected === game.game?.id ? "page" : undefined} onClick={event => { if (!editing) choose(game, event.currentTarget); }}>{art(game) ? <GameArt src={art(game) ?? ""}/> : game.source === "shortcut" ? <SteamShortcutIcon game={game.shortcut} library={shortcuts} active={active && !concealed}/> : <Library size={22}/>}<span>{game.name}{mark ? <em>{t(`games.badge.${mark.badge}`)}</em> : game.source === "custom" && game.ready && game.lastPlayed === 0 && <em data-ready>{t("games.setup.phase.ready")}</em>}</span></button></HoverTooltip>
          {editing ? <div className="games-library-arrange-actions">
            <button aria-label={t("games.sidebar.move", { name: game.name })} title={t("games.sidebar.move", { name: game.name })} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onPointerDown={event => { if (event.button !== 0) return; drag.current = { id: game.id, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => {
                const current = drag.current;
                if (!current || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
                setDragging(current.id);
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-id]")?.dataset.sidebarId;
                current.target = target && preferences.value.pinned.includes(target) === preferences.value.pinned.includes(current.id) ? target : undefined;
                setDropTarget(current.target ?? null);
                const bounds = list.current?.getBoundingClientRect();
                if (bounds && list.current) { if (event.clientY > bounds.bottom - 28) list.current.scrollTop += 14; else if (event.clientY < bounds.top + 28) list.current.scrollTop -= 14; }
              }}
              onPointerUp={event => { const current = drag.current; drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(null); setDropTarget(null); if (current?.target) move(current.id, current.target); }}
              onPointerCancel={() => { drag.current = null; setDragging(null); setDropTarget(null); }}><GripVertical size={16}/></button>
            <button title={t("games.sidebar.up", { name: game.name })} aria-label={t("games.sidebar.up", { name: game.name })} disabled={position === 0} onClick={() => move(game.id, group[position - 1].id)}><ArrowUp size={15}/></button>
            <button title={t("games.sidebar.down", { name: game.name })} aria-label={t("games.sidebar.down", { name: game.name })} disabled={position === group.length - 1} onClick={() => move(game.id, group[position + 1].id)}><ArrowDown size={15}/></button>
            <button title={t(isPinned ? "games.sidebar.unpin" : "games.sidebar.pin", { name: game.name })} aria-label={t(isPinned ? "games.sidebar.unpin" : "games.sidebar.pin", { name: game.name })} aria-pressed={isPinned} onClick={() => toggle("pinned", game.id)}><Pin size={15}/></button>
            <button title={t(hidden ? "games.sidebar.restore" : "games.sidebar.hide", { name: game.name })} aria-label={t(hidden ? "games.sidebar.restore" : "games.sidebar.hide", { name: game.name })} aria-pressed={hidden} onClick={() => toggle("hidden", game.id)}>{hidden ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
          </div> : !collapsed && <div className="games-library-side-actions"><button aria-label={t(game.favorite ? "games.dock.unfavoriteGame" : "games.dock.favoriteGame", { name: game.name })} aria-pressed={game.favorite} disabled={prefs.busy} onClick={() => void favorite(game)}><MusicGlyph name={game.favorite ? "heart-filled" : "heart"} size={14}/></button>{game.source==="custom"&&!game.ready&&custom.available&&<button aria-label={t("games.launchHealth.repairNamed",{name:game.name})} onClick={event=>access.repairCustom(game.custom.id,event.currentTarget)}><Settings2 size={14}/></button>}{game.ready && library.available && <button aria-label={game.source === "launcher" && game.install.launchMode === "client" ? t("games.dock.openClient", { name: game.name, launcher: LAUNCHER_NAMES[game.install.launcher] }) : t("games.library.playGame", { name: game.name })} disabled={busy(game)} onClick={() => launch(game)}>{game.source === "launcher" && game.install.launchMode === "client" ? <ArrowUpRight size={15}/> : <Play size={14}/>}</button>}</div>}
        </div>
      </div>; })}</section>; })}
      {!loading && !shown.length && !collapsed && <p className="games-library-side-empty">{t(games.length ? "games.noResults" : "games.dock.emptyNote")}{games.length > 0 && <button className="games-library-arrange-open" onClick={() => { setEditing(true); setOptions(false); setQuery(""); }}>{t("games.sidebar.arrange")}</button>}</p>}
    </div>
    <footer>{!collapsed && (prefs.error || launchers.launchError) && <p className="games-library-side-empty" role="alert">{t(prefs.error || "games.dock.launchError")}<button aria-label={t("common.close")} onClick={() => { prefs.dismissError(); launchers.dismissLaunchError(); }}><X size={16}/></button></p>}</footer>
    {context && context.profile === access.profile && active && !concealed && <GameLibraryContextMenu key={`${context.profile}:${context.game.id}`} target={{ ...context, game: contextGame ?? context.game }} source={source(contextGame ?? context.game)} art={art(contextGame ?? context.game)} native={isTauri()} windows={osClass() === "windows"} pinned={pinned(contextGame ?? context.game)} hidden={preferences.value.hidden.includes(context.game.id)} busy={!!contextGame && (busy(contextGame) || running(contextGame))} run={manageGame} close={closeContext}/>}
    {notebook && notebook.profile === access.profile && active && <GameNotesDialog key={`${notebook.profile}:${notebook.id}`} profile={notebook.profile} gameId={notebook.id} name={notebook.name} onClose={() => setNotebook(null)}/>}
  </aside>;
}
