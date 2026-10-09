import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronDown, RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { openUrl } from "@/lib/window";
import { loadWowRealms } from "@/lib/games/wow-realms";
import { filterWowRealms, matchingWowRealm, wowRealmRegion, wowRealmStatusUrl, WOW_REALM_TTL, type WowRealm } from "@/lib/games/wow-realm-data";
import type { WowRegion } from "@/lib/games/wow-data";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-wow-realm-field.css";

export function GameWowRealmField({ region, value, onChange, active }: { region: WowRegion; value: string; onChange: (value: string) => void; active: boolean }) {
  const t = useT(), language = useUiLanguage(), id = useId();
  const field = useRef<HTMLLabelElement>(null), input = useRef<HTMLInputElement>(null), menu = useRef<HTMLDivElement>(null);
  const [observation, setObservation] = useState<{ data: WowRealm[]; at: number } | null>(null);
  const [failed, setFailed] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false), [index, setIndex] = useState(-1), [now, setNow] = useState(Date.now);
  const [box, setBox] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const supported = wowRealmRegion(region), revision = useLiveRefresh(active, WOW_REALM_TTL);
  useEffect(() => {
    if (!active || !wowRealmRegion(region) || document.hidden) { setBusy(false); return; }
    const controller = new AbortController(); setBusy(true);
    void loadWowRealms(region, controller.signal).then(result => {
      if (!controller.signal.aborted) { setObservation(result); setFailed(false); setBusy(false); setNow(Date.now()); }
    }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, region, revision, attempt]);
  useEffect(() => {
    if (!active) { setOpen(false); return; }
    setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [active]);
  const realms = observation?.data ?? [], matches = filterWowRealms(realms, value, language);
  const selected = matchingWowRealm(realms, value);
  const fresh = !!observation && !failed && now >= observation.at && now - observation.at < 2 * WOW_REALM_TTL;
  const status = (realm: WowRealm) => fresh && realm.online !== null ? realm.online ? "online" : "offline" : "unknown";
  const choose = (realm: WowRealm) => { onChange(realm.name); setOpen(false); setIndex(-1); input.current?.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    if (!open || !field.current) { setBox(null); return; }
    const rect = field.current.getBoundingClientRect(), height = Math.min(280, Math.max(120, matches.length * 48 + 12));
    const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
    const upwards = below < height && above > below, maxHeight = Math.max(80, Math.min(height, upwards ? above : below));
    setBox({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), top: upwards ? rect.top - maxHeight - 6 : rect.bottom + 6, width: Math.min(rect.width, window.innerWidth - 16), maxHeight });
  }, [open, matches.length]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => { if (!field.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    const closeScroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const closeResize = () => setOpen(false);
    const back = (event: KeyboardEvent) => { if (isBackKey(event)) { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); input.current?.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("focusin", closeOutside);
    document.addEventListener("scroll", closeScroll, true); window.addEventListener("resize", closeResize); window.addEventListener("keydown", back, true);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("focusin", closeOutside); document.removeEventListener("scroll", closeScroll, true); window.removeEventListener("resize", closeResize); window.removeEventListener("keydown", back, true); };
  }, [open]);
  useEffect(() => { if (open && index >= 0) menu.current?.querySelector(`[data-realm-index="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index, open]);
  return <>
    <label ref={field} className="games-wow-realm-field"><span>{t("games.wow.character.realm")}</span><div data-tv-focus-container>
      <input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && index >= 0 && matches[index] ? `${id}-${index}` : undefined} value={value} autoComplete="off" spellCheck={false} maxLength={80} required
        onClick={() => { if (realms.length) setOpen(true); }} onChange={event => { onChange(event.target.value); setIndex(-1); setOpen(realms.length > 0); }}
        onKeyDown={event => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && realms.length) { event.preventDefault(); event.stopPropagation(); setOpen(true); setIndex(current => matches.length ? Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))) : -1); }
          else if (event.key === "Enter" && open && index >= 0 && matches[index]) { event.preventDefault(); event.stopPropagation(); choose(matches[index]); }
          else if (event.key === "Tab") setOpen(false);
        }}/>
      {!!realms.length && <button type="button" aria-label={t("games.wow.realm.browse")} aria-expanded={open} onClick={() => { setOpen(previous => !previous); setIndex(-1); input.current?.focus({ preventScroll: true }); }}><ChevronDown size={16}/></button>}
    </div></label>
    <div className="games-wow-realm-info" aria-live="polite">
      {!supported ? <span>{t("games.wow.realm.unsupported")}</span> : <>
        {selected && <><strong>{selected.name}</strong><span className={`games-wow-realm-state is-${status(selected)}`}><i/>{t(`games.wow.realm.${status(selected)}`)}</span>{selected.population && <span>{t(`games.wow.realm.${selected.population}`)}</span>}{selected.type && <span>{t(`games.wow.realm.${selected.type}`)}</span>}{selected.newCharactersLocked && <span>{t("games.wow.realm.locked")}</span>}</>}
        {failed ? <span>{t("games.wow.realm.unavailable")}</span> : busy && !observation ? <span>{t("common.loading")}</span> : null}
        <a href={wowRealmStatusUrl(region)} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(wowRealmStatusUrl(region)); }}>{t("games.wow.realm.source")}<ArrowUpRight size={12}/></a>
        {observation && selected && <time dateTime={new Date(observation.at).toISOString()}>{t("games.wow.checked", { date: new Date(observation.at).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" }) })}</time>}
        <button type="button" disabled={busy} aria-label={t("games.wow.realm.refresh")} onClick={() => setAttempt(previous => previous + 1)}><RefreshCw size={13}/></button>
      </>}
    </div>
    {open && box && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-label={t("games.wow.character.realm")} className="games-wow-realm-menu" style={box}>
      {matches.length ? matches.map((realm, optionIndex) => <button type="button" role="option" tabIndex={-1} id={`${id}-${optionIndex}`} data-realm-index={optionIndex} key={realm.slug} aria-selected={optionIndex === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(realm)}>
        <span>{realm.name}</span><small className={`games-wow-realm-state is-${status(realm)}`}><i/>{t(`games.wow.realm.${status(realm)}`)}</small>
      </button>) : <p>{t("games.wow.realm.noMatches")}</p>}
    </div>, document.body)}
  </>;
}
