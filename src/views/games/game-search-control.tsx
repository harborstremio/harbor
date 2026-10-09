import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { providerTabFor } from "@/lib/ai-models";
import { AiModeButton } from "@/components/search/ai-mode-button";
import { readGameSearchHistory, rememberGameSearch, saveGameSearchHistory, type RecentGameSearch } from "@/lib/games/search-history";

export function GameSearchControl({ query, change, expanded, ai, setAi, submit, profile }: { query: string; change: (value: string) => void; expanded: boolean; ai: boolean; setAi: (value: boolean) => void; submit: () => void; profile: string }) {
  const t = useT(), { settings, update } = useSettings();
  const input = useRef<HTMLInputElement>(null), lastRemembered = useRef(""), [history, setHistory] = useState(() => readGameSearchHistory(profile));
  useEffect(() => { setHistory(readGameSearchHistory(profile)); lastRemembered.current = ""; }, [profile]);
  const write = (items: RecentGameSearch[]) => { setHistory(items); saveGameSearchHistory(profile, items); };
  const remember = (entry = { query, ai }, explicit = false) => {
    const signature = JSON.stringify([entry.query.trim(), entry.ai]);
    if (!explicit && signature === lastRemembered.current) return;
    lastRemembered.current = signature;
    write(rememberGameSearch(history, entry));
  };
  return <div className={`games-search-control${expanded ? " is-expanded" : ""}`}>
    <form className="games-search" onSubmit={event => { event.preventDefault(); remember(undefined, true); submit(); }}><Search size={expanded ? 24 : 18}/><input ref={input} aria-label={t(ai ? "games.searchUi.aiPlaceholder" : "games.search")} placeholder={t(ai ? "games.searchUi.aiPlaceholder" : "games.search")} maxLength={ai ? 500 : 180} value={query} onChange={event => { lastRemembered.current = ""; change(event.target.value); }} onBlur={() => { if (!ai) remember(); }}/>{query && <button type="button" className="games-icon-button" aria-label={t("games.clear")} onClick={() => { change(""); input.current?.focus(); }}><X size={20}/></button>}{expanded && <AiModeButton active={ai} currentModel={settings.aiSearchModel} onToggle={() => setAi(!ai)} onSelectModel={id => { update({ aiSearchModel: id, aiSearchProvider: providerTabFor(id) }); setAi(true); }}/>}</form>
    {expanded && <div className="games-search-history-slot">{history.length > 0 ? <div className="games-search-recents" role="group" aria-label={t("games.searchUi.recents")}><span>{t("games.searchUi.recents")}</span>{history.map(item => <div className="games-search-recent" key={item.query} onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }}><button type="button" onClick={() => { remember(item, true); change(item.query); setAi(item.ai); input.current?.focus(); }}>{item.query}</button><button type="button" aria-label={t("games.searchUi.removeRecent", { query: item.query })} onClick={event => {
      const pill = event.currentTarget.parentElement;
      const next = pill?.nextElementSibling?.querySelector("button") ?? pill?.previousElementSibling?.querySelector("button") ?? input.current;
      if (event.currentTarget.matches(":focus-visible")) next?.focus({ preventScroll: true });
      write(history.filter(value => value.query !== item.query));
    }}><X size={14}/></button></div>)}</div> : <p className="games-search-guide">{t(ai ? "games.searchUi.aiGuide" : "games.searchUi.guide")}</p>}</div>}
  </div>;
}
