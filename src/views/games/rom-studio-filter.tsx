import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { pushBackHandler } from "@/lib/back-intercept";
import { searchStudios } from "@/lib/games/studios";
import type { AtlasGame, GameConnection } from "@/lib/games/igdb-data";

export function RomStudioFilter({ value, games, onChange }: { value?: number; games: AtlasGame[]; onChange: (id?: number) => void }) {
  const t = useT(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState<GameConnection[]>([]), [known, setKnown] = useState<GameConnection[]>([]), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const incoming = games.flatMap(game => [...game.developers, ...game.publishers]);
  const key = incoming.map(item => item.id).join(",");
  useEffect(() => { if (incoming.length) setKnown(old => [...new Map([...old, ...incoming].map(item => [item.id, item])).values()]); }, [key]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const back = pushBackHandler(() => { close(); return true; });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => { back(); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  useEffect(() => {
    setResults([]); setFailed(false);
    if (!open || query.trim().length < 2) { setBusy(false); return; }
    const request = new AbortController(); setBusy(true);
    const timer = setTimeout(() => void searchStudios(query, request.signal).then(rows => {
      if (!request.signal.aborted) { setResults(rows); setKnown(old => [...new Map([...old, ...rows].map(item => [item.id, item])).values()]); }
    }, () => { if (!request.signal.aborted) setFailed(true); }).finally(() => { if (!request.signal.aborted) setBusy(false); }), 300);
    return () => { clearTimeout(timer); request.abort(); };
  }, [open, query, attempt]);
  const options = [...new Map([...known, ...results].filter(item => !query || item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(item => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return <div ref={root} className="games-rom-studio-filter" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && open) {
      event.preventDefault(); const items = [...(root.current?.querySelectorAll<HTMLElement>("input, [role=option]") ?? [])], current = items.indexOf(document.activeElement as HTMLElement);
      items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }}>
    <button ref={trigger} className="games-text-action" aria-label={t("games.roms.studio")} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(old => !old)}>{known.find(item => item.id === value)?.name ?? t("games.roms.allStudios")}<ChevronDown size={14}/></button>
    {open && <div className="games-rom-studio-menu"><label className="games-search"><Search size={15}/><input ref={input} aria-label={t("games.roms.studio")} placeholder={t("games.roms.studio")} value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div role="listbox" aria-label={t("games.roms.studio")}><button role="option" aria-selected={value === undefined} onClick={() => { onChange(undefined); close(); }}>{t("games.roms.allStudios")}{value === undefined && <Check size={14}/>}</button>{options.map(item => <button key={item.id} role="option" aria-selected={value === item.id} onClick={() => { onChange(item.id); close(); }}>{item.name}{value === item.id && <Check size={14}/>}</button>)}</div>
      {busy && <span role="status">{t("common.loading")}</span>}{failed && <button className="games-text-action" onClick={() => setAttempt(old => old + 1)}>{t("common.retry")}</button>}{!busy && !failed && !options.length && <span role="status">{t("games.noResults")}</span>}
    </div>}
  </div>;
}
