import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadWowAddonInventory } from "@/lib/games/wow-addons";
import { filterWowAddons, wowAddonGameVersion, wowAddonWebsite, type WowAddonInventory } from "@/lib/games/wow-addon-data";
import { GameWowAddonMedia } from "./game-wow-addon-media";
import { GameWowAddonManager } from "./game-wow-addon-manager";
import "./game-wow-addons.css";

export function GameWowAddons({ id, profile, active }: { id: string; profile: string; active: boolean }) {
  const t = useT(), language = useUiLanguage(), titleId = useId(), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [data, setData] = useState<WowAddonInventory | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0), [query, setQuery] = useState(""), [attention, setAttention] = useState(false), [limit, setLimit] = useState(12);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "160px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    let current = true; setBusy(true); setFailed(false);
    void loadWowAddonInventory(id).then(value => { if (current) { setData(value); setBusy(false); } }, () => { if (current) { setFailed(true); setBusy(false); } });
    return () => { current = false; };
  }, [id, active, visible, attempt]);
  const shown = data?.id === id ? data : null, matches = filterWowAddons(shown?.addons ?? [], query, attention);
  return <section ref={root} className="games-wow-addons games-inset" aria-labelledby={titleId}>
    <header><div><h2 id={titleId}>{t("games.wow.addons.title")}{shown && <span>{shown.addons.length.toLocaleString(language)}</span>}</h2><p>{t("games.wow.addons.intro")}</p></div><button className="games-button" disabled={busy} aria-label={t("games.wow.addons.refresh")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button></header>
    {shown?.clientVersion && <p className="games-wow-addons-client">{t("games.wow.addons.client", { version: shown.clientVersion.split('.').slice(0, 3).join('.') })}</p>}
    <GameWowAddonManager key={`${profile}:${id}`} id={id} profile={profile} active={active} inventory={shown} changed={() => setAttempt(value => value + 1)}/>
    {failed && <p className="games-wow-addons-message" role="status">{t("games.wow.addons.unavailable")}</p>}
    {shown?.partial && <p className="games-wow-addons-message" role="status">{t("games.wow.addons.partial")}</p>}
    {!shown && !failed ? <div className="games-wow-addons-loading" aria-busy="true" aria-label={t("common.loading")}>{[0,1,2].map(index => <i key={index} className="games-detail-skeleton"/>)}</div> : shown && <>
      {shown.addons.length > 0 ? <>
        <div className="games-wow-addons-tools"><label data-tv-focus-container><Search size={17}/><input type="search" value={query} placeholder={t("games.wow.addons.search")} aria-label={t("games.wow.addons.search")} onChange={event => { setQuery(event.target.value); setLimit(12); }} maxLength={120}/></label><button className="games-button" aria-pressed={attention} onClick={() => { setAttention(value => !value); setLimit(12); }}>{t("games.wow.addons.attention")}</button></div>
        <div className="games-wow-addons-list">{matches.slice(0, limit).map(addon => {
          const metadata = addon.manifest, url = wowAddonWebsite(addon);
          const expansionKey = `${id}:${addon.folder}`;
          return <details key={expansionKey} open={expanded.has(expansionKey)} onToggle={event => { const open = event.currentTarget.open; setExpanded(previous => { if (previous.has(expansionKey) === open) return previous; const next = new Set(previous); if (open) next.add(expansionKey); else next.delete(expansionKey); return next; }); }}>
            <summary><div><strong>{metadata?.title || addon.folder}</strong><small>{metadata?.author || addon.folder}</small></div><span>{metadata?.version || "—"}</span>{(addon.state !== "ready" || addon.missingDependencies.length > 0) && <span className="games-wow-addons-attention"><AlertCircle size={16} aria-hidden="true"/><span>{t("games.wow.addons.attention")}</span></span>}<ChevronDown size={17}/></summary>
            <div className="games-wow-addon-details">
              {metadata?.notes && <p>{metadata.notes}</p>}
              {addon.state !== "ready" && <p role="status">{t(`games.wow.addons.${addon.state}`)}</p>}
              {addon.missingDependencies.length > 0 && <p className="games-wow-addons-attention">{t("games.wow.addons.missing", { names: addon.missingDependencies.join(", ") })}</p>}
              {metadata && <dl><div><dt>{t("games.wow.addons.gameVersions")}</dt><dd>{metadata.interfaces.map(wowAddonGameVersion).filter(Boolean).join(" · ") || "—"}</dd></div>{metadata.dependencies.length > 0 && <div><dt>{t("games.wow.addons.requires")}</dt><dd>{metadata.dependencies.join(", ")}</dd></div>}<div><dt>{t("games.wow.addons.folder")}</dt><dd>{addon.folder}</dd></div></dl>}
              {url && <a href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(url); }}>{t("games.wow.addons.website")}<ArrowUpRight size={14}/></a>}
              {!!metadata?.wowiId && expanded.has(expansionKey) && <GameWowAddonMedia key={`${id}:${metadata.wowiId}`} id={metadata.wowiId} active={active}/>}
            </div>
          </details>;
        })}</div>
        {!matches.length && <p className="games-wow-addons-message">{t("games.wow.addons.noMatches")}</p>}
        {matches.length > limit && <button className="games-button games-wow-addons-more" onClick={() => setLimit(value => value + 24)}>{t("games.wow.addons.more")}</button>}
      </> : <p className="games-wow-addons-message">{t("games.wow.addons.empty")}</p>}
      <footer><time dateTime={new Date(shown.checkedAt).toISOString()}>{t("games.wow.checked", { date: new Date(shown.checkedAt).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" }) })}</time><p>{t("games.wow.addons.scope")}</p></footer>
    </>}
  </section>;
}
