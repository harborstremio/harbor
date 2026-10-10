import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { FileArchive, History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import type { MinecraftLifecycleAction } from "@/lib/games/minecraft-lifecycle";
import "./minecraft-lifecycle.css";

export function MinecraftInstanceMenu({ name, choose }: { name: string; choose: (action: MinecraftLifecycleAction | "rename") => void }) {
  const t = useT(), id = useId(), anchor = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), [open, setOpen] = useState(false);
  const close = useCallback(() => { setOpen(false); anchor.current?.focus({ preventScroll: true }); }, []);
  useSectionBack(close, open);
  useLayoutEffect(() => { if (open) { const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>("button")?.focus()); return () => cancelAnimationFrame(frame); } }, [open]);
  const items = [{ action: "rename", icon: Pencil, label: "games.minecraft.instances.rename" }, { action: "export", icon: FileArchive, label: "games.minecraft.lifecycle.export" }, { action: "storage", icon: History, label: "games.minecraft.lifecycle.storage" }, { action: "remove", icon: Trash2, label: "games.minecraft.lifecycle.remove" }] as const;
  return <><button ref={anchor} className="games-icon-button" title={t("games.minecraft.lifecycle.options")} aria-label={t("games.minecraft.lifecycle.optionsName", { name })} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(v => !v)}><MoreHorizontal size={17} /></button><AnchoredMenu anchorRef={anchor} open={open} onClose={close} width={Math.min(240, window.innerWidth - 16)}><div ref={menu} id={id} role="menu" className="mc-instance-menu" aria-label={t("games.minecraft.lifecycle.options")} onKeyDown={e => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowUp" || e.key === "Tab" && e.shiftKey ? -1 : 1) + buttons.length) % buttons.length; buttons[next]?.focus(); }
  }}>{items.map(({ action, icon: Icon, label }) => <button role="menuitem" key={action} onClick={() => { close(); choose(action); }}><Icon size={17} /><span>{t(label)}</span></button>)}</div></AnchoredMenu></>;
}
