import { GameNotesIcon } from "./game-notes-launcher";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, ChevronRight, EyeOff, FolderOpen, Info, LoaderCircle, Monitor, Pin, Settings2, Trash2, X } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { libraryMenuActions, menuPosition, uninstallRoute, type LibraryAction } from "@/lib/games/library-management";
import type { QuickGame } from "@/lib/games/quick-library";
import { GameArt } from "./game-art";
import "./game-library-context-menu.css";

export type LibraryMenuTarget = { game: QuickGame; origin: HTMLElement; x: number; y: number };
type Props = { target: LibraryMenuTarget; source: string; art?: string; native: boolean; windows: boolean; pinned: boolean; busy: boolean; hidden: boolean; run: (action: LibraryAction) => Promise<void>; close: () => void };

export function GameLibraryContextMenu({ target, source, art, native, windows, pinned, hidden, busy, run, close }: Props) {
  const t = useT(), { game } = target, id = useId();
  const [submenu, setSubmenu] = useState(false), [confirm, setConfirm] = useState<"uninstall" | "remove" | null>(null);
  const [working, setWorking] = useState(false), [failed, setFailed] = useState(false);
  const [compact, setCompact] = useState(() => innerWidth < 580);
  const lock = useRef(false), alive = useRef(true), root = useRef<HTMLDivElement>(null), child = useRef<HTMLDivElement>(null), manage = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: target.x, top: target.y }), [childPosition, setChildPosition] = useState({ left: 0, top: 0 });
  const { main, manage: actions } = libraryMenuActions(game, native, windows);
  const route = uninstallRoute(game, native, windows), rtl = document.documentElement.dir === "rtl";
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const back = () => { if (working) return; if (submenu) { setSubmenu(false); requestAnimationFrame(() => manage.current?.focus()); } else close(); };
  useSectionBack(back, !confirm, true);
  useLayoutEffect(() => {
    if (confirm) return;
    const place = () => {
      setCompact(innerWidth < 580);
      const box = root.current?.getBoundingClientRect();
      if (box) setPosition(menuPosition(target.x, target.y, box.width, box.height, innerWidth, innerHeight));
      if (submenu && !compact) {
        const parent = manage.current?.getBoundingClientRect(), sub = child.current?.getBoundingClientRect();
        if (parent && sub) {
          const right = parent.right + 6, left = parent.left - sub.width - 6;
          const x = rtl ? left >= 8 ? left : right : right + sub.width <= innerWidth - 8 ? right : left;
          setChildPosition(menuPosition(x, parent.top - 6, sub.width, sub.height, innerWidth, innerHeight));
        }
      }
    };
    place(); const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", place); };
  }, [submenu, confirm, target.x, target.y, failed, rtl, compact]);
  useEffect(() => {
    if (confirm) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true }));
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !lock.current) close(); };
    const scroll = (event: Event) => { if (!root.current?.contains(event.target as Node) && !lock.current) close(); };
    document.addEventListener("pointerdown", outside, true); window.addEventListener("scroll", scroll, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", outside, true); window.removeEventListener("scroll", scroll, true); };
  }, [confirm, close]);
  const label = (action: LibraryAction) => {
    if (action === "notes") return t("games.notes.title");
    const key = action === "favorite" ? game.favorite ? "unfavorite" : "favorite" : action === "pin" ? pinned ? "unpin" : "pin" : action === "hide" && hidden ? "restore" : action === "uninstall" && route !== "steam" ? "uninstallOptions" : action;
    return t(`games.manage.${key}`);
  };
  const icons: Record<LibraryAction, ReactNode> = { notes: <GameNotesIcon/>, gameplay: <Play size={18}/>, trailer: <Play size={18}/>, play: <Play size={18}/>, favorite: <MusicGlyph name={game.favorite ? "heart-filled" : "heart"} size={18}/>, pin: <Pin size={18}/>, details: <Info size={18}/>, browse: <FolderOpen size={18}/>, properties: <Settings2 size={18}/>, desktop: <Monitor size={18}/>, hide: <EyeOff size={18}/>, uninstall: <Trash2 size={18}/>, remove: <X size={18}/> };
  const act = async (action: LibraryAction) => {
    if (lock.current) return;
    if (action === "uninstall" || action === "remove") { setConfirm(action); return; }
    lock.current = true; setWorking(true); setFailed(false);
    try { await run(action); if (alive.current) close(); }
    catch { if (alive.current) setFailed(true); }
    finally { lock.current = false; if (alive.current) setWorking(false); }
  };
  const item = (action: LibraryAction) => <button key={action} role="menuitem" data-action={action} disabled={working || busy && ["play", "uninstall", "remove", "desktop"].includes(action)} onClick={() => void act(action)} data-danger={action === "uninstall" || action === "remove" || undefined}>{icons[action]}<span className="g-library-item-label">{label(action)}</span></button>;
  const openManage = (focus = false) => { setSubmenu(true); if (focus) requestAnimationFrame(() => child.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()); };
  if (confirm) return <GameUninstallConfirmation game={game} source={route === "windows" ? "Windows" : source} art={art} action={confirm} route={route} run={() => run(confirm)} close={close}/>;
  return createPortal(<div ref={root} className="g-library-context" style={position} data-dropdown-menu data-local-keyboard onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const inChild = child.current?.contains(event.target as Node), forward = rtl ? "ArrowLeft" : "ArrowRight", backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); back(); return; }
    if (event.key === "Tab") { event.preventDefault(); event.stopPropagation(); if (!working) close(); return; }
    if (event.key === forward && !inChild && event.target === manage.current) { event.preventDefault(); event.stopPropagation(); openManage(true); return; }
    if (event.key === backward && inChild) { event.preventDefault(); event.stopPropagation(); back(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const panel = inChild ? child.current : root.current?.querySelector('[role="menu"]');
    const buttons = [...panel?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }}>
    <header>{art && <GameArt src={art}/>}<span><strong>{game.name}</strong><small>{source}</small></span></header>
    <div role="menu" aria-label={game.name} aria-busy={working} hidden={compact && submenu}>
      {main.map(action => <div key={action} onPointerEnter={() => setSubmenu(false)}>{item(action)}</div>)}
      <hr/>
      <button ref={manage} role="menuitem" aria-haspopup="menu" aria-expanded={submenu} aria-controls={submenu ? id : undefined} onPointerEnter={() => openManage()} onClick={() => submenu ? setSubmenu(false) : openManage(true)}><Settings2 size={18}/><span>{t("games.manage.manage")}</span><ChevronRight className="g-library-context-chevron" size={16}/></button>
    </div>
    {failed && <p role="alert">{t("games.manage.failed")}</p>}
    {submenu && <div ref={child} id={id} className="g-library-context-submenu" data-compact={compact || undefined} style={compact ? undefined : childPosition} role="menu" aria-label={t("games.manage.manage")} aria-busy={working}>{compact && <><button role="menuitem" onClick={back}><ChevronRight size={16} style={{ transform: rtl ? undefined : "rotate(180deg)" }}/><span>{t("common.back")}</span></button><hr/></>}{actions.map(item)}</div>}
  </div>, document.body);
}

function GameUninstallConfirmation({ game, source, art, action, route, run, close: dismiss }: { game: QuickGame; source: string; art?: string; action: "uninstall" | "remove"; route: ReturnType<typeof uninstallRoute>; run: () => Promise<void>; close: () => void }) {
  const t = useT(), id = useId(), content = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null), lock = useRef(false), alive = useRef(true);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [done, setDone] = useState(false);
  const { closing, close } = useModalExit(dismiss), safeClose = useCallback(() => { if (!lock.current) close(); }, [close]);
  useSectionBack(safeClose, true, true);
  useEffect(() => { alive.current = true; cancel.current?.focus(); return () => { alive.current = false; }; }, []);
  const confirm = async () => {
    if (lock.current || done || closing) return;
    lock.current = true; setBusy(true); setFailed(false);
    try { await run(); if (alive.current) setDone(true); }
    catch { if (alive.current) setFailed(true); }
    finally { lock.current = false; if (alive.current) { setBusy(false); requestAnimationFrame(() => cancel.current?.focus()); } }
  };
  const remove = action === "remove", direct = route === "steam";
  return <ModalShell closing={closing} onDismiss={safeClose} width={470} labelledBy={id} backdropClassName="g-library-confirm-backdrop">
    <div className="g-library-confirm" ref={content} data-local-keyboard onKeyDown={event => {
      if (event.key !== "Tab") return;
      const buttons = [...content.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []];
      if (!buttons.length) { event.preventDefault(); return; }
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }}>
      <header>{art && <GameArt src={art}/>}<span><strong>{game.name}</strong><small>{source}</small></span></header>
      <h2 id={id}>{t(`games.manage.${done ? remove ? "removed" : "sent" : remove ? "removeTitle" : direct ? "uninstallTitle" : "optionsTitle"}`, { source })}</h2>
      <p>{t(`games.manage.${done ? remove ? "removedNote" : "sentNote" : remove ? "removeNote" : direct ? "steamNote" : route === "launcher" ? "launcherNote" : "windowsNote"}`, { name: game.name, source })}</p>
      {failed && <p className="g-library-confirm-error" role="alert">{t("games.manage.failed")}</p>}
      <footer><button ref={cancel} className="games-button" disabled={busy} onClick={safeClose}>{t(done ? "common.done" : "common.cancel")}</button>{!done && <button className="games-button games-button-primary" disabled={busy || closing} onClick={() => void confirm()}>{busy ? <LoaderCircle size={17} className="g-library-spin"/> : remove || direct ? <Trash2 size={17}/> : <ArrowUpRight size={17}/>} {t(busy ? "games.manage.opening" : remove ? "games.manage.remove" : direct ? "games.manage.confirmUninstall" : "games.manage.openSource", { source })}</button>}{done && <Check size={20} aria-hidden="true"/>}</footer>
    </div>
  </ModalShell>;
}
