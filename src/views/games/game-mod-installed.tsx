import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { History, MoreHorizontal, Trash2, X } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { modRequest, parseModProject, type ModPackage, type ModProject } from "@/lib/games/mods";
import { GameMark } from "./game-ui";

type ModAction = "enable" | "disable" | "remove" | "rollback";
export function ModInstalledRow({ item, backup, busy, action, versions }: {
  item: ModPackage; backup?: ModPackage; busy: boolean;
  action: (item: ModPackage, action: ModAction) => Promise<boolean>;
  versions: (project: ModProject) => void;
}) {
  const t = useT(), id = useId(), row = useRef<HTMLElement>(null), anchor = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const actionFocus = useRef<HTMLButtonElement | null>(null);
  const [project, setProject] = useState<ModProject | null>(null), [failedArt, setFailedArt] = useState(false);
  const [open, setOpen] = useState(false), [confirm, setConfirm] = useState<"remove" | "rollback" | null>(null);
  const closeMenu = useCallback(() => { setOpen(false); anchor.current?.focus({ preventScroll: true }); }, []);
  const closeConfirm = () => { if (!busy) { setConfirm(null); anchor.current?.focus({ preventScroll: true }); } };
  useSectionBack(confirm ? closeConfirm : closeMenu, open || !!confirm);
  useEffect(() => {
    const controller = new AbortController(); let started = false;
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting)) return;
      started = true; observer.disconnect();
      void modRequest({ kind: "project", query: item.project }, controller.signal).then(value => parseModProject(value, item.project))
        .then(value => { if (!controller.signal.aborted) setProject(value); }).catch(() => {});
    }, { rootMargin: "160px" });
    if (row.current) observer.observe(row.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [item.project]);
  useLayoutEffect(() => {
    if (!open && !confirm) return;
    const frame = requestAnimationFrame(() => (confirm ? cancel.current : menu.current?.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, confirm]);
  const optionsLabel = t("games.mods.options", { name: item.name });
  const choose = (value: "remove" | "rollback") => { setOpen(false); setConfirm(value); };
  useLayoutEffect(() => {
    if (busy || !actionFocus.current) return;
    const target = actionFocus.current; actionFocus.current = null;
    // Restore after React re-enables the control, without stealing focus moved elsewhere.
    if (document.activeElement === document.body && target.isConnected && !target.disabled) target.focus({ preventScroll: true });
  }, [busy, confirm]);
  const viewVersions = () => versions(project ?? { id: item.project, slug: item.project, title: item.name, description: "", icon: "", downloads: 0, author: "", categories: [] });
  return <article ref={row} className={`games-mod-installed${item.enabled ? "" : " is-disabled"}`} aria-labelledby={id} aria-busy={busy}>
    <span className="games-mod-installed-art">{project?.icon && !failedArt ? <img src={project.icon} alt="" loading="lazy" onError={() => setFailedArt(true)} /> : <GameMark kind="create" size={27} />}</span>
    <div className="games-mod-installed-info"><h3 id={id} dir="auto">{item.name}</h3><p><b dir="auto">{item.number}</b><span dir="auto" title={item.filename}>{item.filename}</span></p></div>
    <div className="games-mods-actions">
      <button className="games-button games-mod-versions" disabled={busy || !!confirm} onClick={viewVersions}>{t("games.mods.versions")}</button>
      <button className="games-mod-toggle" role="switch" aria-checked={item.enabled} aria-labelledby={id} disabled={busy || !!confirm} onClick={event => { actionFocus.current = event.currentTarget; void action(item, item.enabled ? "disable" : "enable"); }}><span>{t(item.enabled ? "games.mods.enabled" : "games.mods.disabled")}</span><i aria-hidden="true" /></button>
      <HoverTooltip label={optionsLabel} align="end" disabled={open || !!confirm}><button ref={anchor} className="games-icon-button" disabled={busy} aria-label={optionsLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined} onClick={() => { if (confirm) closeConfirm(); else setOpen(value => !value); }}><MoreHorizontal size={19} /></button></HoverTooltip>
    </div>
    {confirm && <div className="games-mod-confirm" role="group" data-dropdown-menu aria-label={t(confirm === "rollback" ? "games.mods.restore" : "games.mods.remove")} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeConfirm(); } }}><span>{t(confirm === "rollback" ? "games.mods.restoreConfirm" : "games.mods.removeConfirm", { version: backup?.number ?? "" })}</span><button className="games-button" disabled={busy} onClick={() => { actionFocus.current = cancel.current; void action(item, confirm).then(done => { if (done) { actionFocus.current = anchor.current; setConfirm(null); } }); }}>{t(confirm === "rollback" ? "games.mods.restore" : "games.mods.remove")}</button><button ref={cancel} className="games-icon-button" disabled={busy} aria-label={t("common.cancel")} onClick={closeConfirm}><X size={16} /></button></div>}
    <AnchoredMenu anchorRef={anchor} open={open} onClose={closeMenu} width={Math.min(250, window.innerWidth - 16)}><div ref={menu} id={`${id}-menu`} role="menu" data-dropdown-menu className="games-mod-options" aria-label={optionsLabel} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])], at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowUp" || event.key === "Tab" && event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>{backup && <button role="menuitem" onClick={() => choose("rollback")}><History size={17} /><span>{t("games.mods.restore")}<small>{backup.number}</small></span></button>}<button role="menuitem" onClick={() => choose("remove")}><Trash2 size={17} /><span>{t("games.mods.remove")}</span></button></div></AnchoredMenu>
  </article>;
}
