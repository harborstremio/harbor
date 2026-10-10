import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { pushBackHandler } from "@/lib/back-intercept";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT, useUiLanguage } from "@/lib/i18n";
import { eveName, eveSecurity, eveSecurityClass, filterEveSystems, type EveUniverse } from "@/lib/games/eve-data";

export function EveSystemField({ universe, label, selected, onChange, active }: { universe: EveUniverse; label: string; selected: number | null; onChange: (id: number | null) => void; active: boolean }) {
  const t = useT(), language = useUiLanguage(), id = useId(), field = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), menu = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(""), [open, setOpen] = useState(false), [index, setIndex] = useState(-1), [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number; transform: string } | null>(null);
  useEffect(() => { if (selected !== null) setText(eveName(universe.byId.get(selected)?.names, language)); }, [selected, universe, language]);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  const matches = useMemo(() => filterEveSystems(universe, text, language), [universe, text, language]);
  const choose = (value: number) => { onChange(value); setText(eveName(universe.byId.get(value)?.names, language)); setOpen(false); input.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); input.current?.focus({ preventScroll: true }); return true; };
    const back = pushBackHandler(close);
    const key = (event: KeyboardEvent) => { if (isBackKey(event)) { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
    const outside = (event: Event) => { if (!field.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key, true); document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside);
    return () => { back(); window.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) { setBox(null); return; }
    const place = () => {
      const r = field.current?.getBoundingClientRect(); if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return; }
      const below = window.innerHeight - r.bottom - 14, above = r.top - 14, up = below < 180 && above > below, width = Math.min(r.width, window.innerWidth - 16);
      setBox({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width, maxHeight: Math.max(100, Math.min(320, up ? above : below)), transform: up ? "translateY(-100%)" : "none" });
    };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) place(); };
    place(); window.addEventListener("resize", place); document.addEventListener("scroll", scroll, true);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("scroll", scroll, true); };
  }, [open]);
  useEffect(() => { if (open && index >= 0) menu.current?.querySelector(`[data-eve-option="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index, open]);
  return <><label className="games-eve-field"><span>{label}</span><div ref={field} data-tv-focus-container><input ref={input} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && index >= 0 && matches[index] ? `${id}-${index}` : undefined} autoComplete="off" spellCheck={false} maxLength={100} value={text} placeholder={t("games.eve.systemSearch")}
    onClick={() => setOpen(true)} onChange={event => { setText(event.target.value); onChange(null); setIndex(-1); setOpen(true); }} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); setOpen(true); setIndex(current => Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))); }
      else if (event.key === "Enter" && open) { event.preventDefault(); event.stopPropagation(); const row = matches[index >= 0 ? index : 0]; if (row) choose(row.id); }
      else if (event.key === "Tab") setOpen(false);
    }}/><button type="button" aria-label={t("games.eve.browseSystems", { field: label })} aria-expanded={open} onClick={() => { setOpen(previous => !previous); setIndex(-1); input.current?.focus({ preventScroll: true }); }}><ChevronDown size={16}/></button></div></label>
    {open && box && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-label={label} className="games-eve-system-menu" style={box}>{matches.length ? matches.map((row, i) => <button key={row.id} id={`${id}-${i}`} type="button" role="option" aria-selected={i === index} tabIndex={-1} data-eve-option={i} onMouseDown={event => event.preventDefault()} onClick={() => choose(row.id)}><span><strong dir="auto">{eveName(row.names, language)}</strong><small dir="auto">{eveName(universe.regions.get(row.region), language)}</small></span><b className={`games-eve-security is-${eveSecurityClass(row)}`}>{eveSecurity(row.security).toFixed(1)}</b></button>) : <p>{t("games.eve.noSystems")}</p>}</div>, document.body)}</>;
}
