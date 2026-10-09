import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadWarframeState } from "@/lib/games/warframe";
import { WARFRAME_OFFICIAL_URL } from "@/lib/games/warframe-official-data";
import { WARFRAME_ART, WARFRAME_BARO_ART, WARFRAME_RELIC_ART, warframeFactionArt } from "@/lib/games/warframe-art";
import { warframeActive, warframeFissures, warframeUsable, WARFRAME_GUIDE, WARFRAME_LOGO, WARFRAME_STALE, WARFRAME_TTL, WARFRAME_WORLDS, type WarframeOperation, type WarframeState } from "@/lib/games/warframe-data";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-warframe-companion.css";

const tiers = ["Lith", "Meso", "Neo", "Axi", "Requiem", "Omnia"];
function duration(end: number, now: number, locale: string) {
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value, index) => value.toLocaleString(locale, { useGrouping: false, minimumIntegerDigits: index ? 2 : 1 })).join(":");
}
export function GameWarframeCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), label = (key: string) => t(`games.warframe.${key}`);
  const [visible, setVisible] = useState(false), [activated, setActivated] = useState(false), [attempt, setAttempt] = useState(0), [now, setNow] = useState(Date.now);
  const [data, setData] = useState<WarframeState | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const [tier, setTier] = useState("all"), [mode, setMode] = useState("all"), [query, setQuery] = useState(""), [limit, setLimit] = useState(8);
  const revision = useLiveRefresh(active && visible, WARFRAME_TTL);
  useEffect(() => {
    if (!active) { setActivated(false); setVisible(false); return; }
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => { const shown = entries.some(entry => entry.isIntersecting); setVisible(shown); if (shown) setActivated(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !activated) return;
    const controller = new AbortController(); setBusy(true); setFailed(false); setNow(Date.now());
    void loadWarframeState(controller.signal, attempt > 0).then(result => { if (!controller.signal.aborted) { setData(result.data); setBusy(false); setNow(Date.now()); } }, () => { if (!controller.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, activated, attempt, revision]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => { if (!document.hidden) setNow(Date.now()); };
    tick(); const timer = setInterval(tick, 1000); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  const usable = data && warframeUsable(data, now), stale = data && now - data.timestamp > WARFRAME_STALE;
  const fissures = data ? warframeFissures(data, now, tier, mode, query) : [];
  const trader = usable && data.trader && data.trader.expiry > now ? data.trader : null;
  const visiting = warframeActive(trader, now);
  const sourceUrl = data?.source === "official" ? WARFRAME_OFFICIAL_URL : "https://hub.warframestat.us/";
  const date = (value: number) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  const ends = (value: number, key = "ends") => t(`games.warframe.${key}`, { time: duration(value, now, language) });
  return <section ref={root} className="games-warframe games-inset" aria-labelledby="warframe-title">
    <header className="games-warframe-heading"><div><GameArt src={WARFRAME_LOGO} className="games-warframe-logo"/><h2 id="warframe-title">{label("title")}</h2><p>{label("intro")}</p></div><button className="games-button" aria-label={label("refresh")} disabled={busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18}/></button></header>
    {failed && <p className="games-warframe-status" role="status">{label("unavailable")}</p>}
    {data && (!usable || stale) && <p className="games-warframe-status" role="status">{label(!usable ? "expired" : "stale")}</p>}
    {data?.partial && <p className="games-warframe-status" role="status">{label("partial")}</p>}
    {!data && !failed ? <div className="games-warframe-loading" aria-busy="true" aria-label={t("common.loading")}><div className="games-warframe-worlds">{WARFRAME_WORLDS.map(world => <i className="games-detail-skeleton" key={world}/>)}</div><i className="games-detail-skeleton"/></div> : <>
      <div className="games-warframe-section-heading"><h3>{label("cycles")}</h3><a href={WARFRAME_GUIDE} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(WARFRAME_GUIDE); }}>{label("guide")}<ArrowUpRight size={14}/></a></div>
      <div className="games-warframe-worlds">{WARFRAME_WORLDS.map(world => {
        const cycle = usable ? data.cycles.find(cycle => cycle.world === world && warframeActive(cycle, now)) : undefined;
        return <article key={world} className="games-warframe-world" data-world={world}><GameArt src={WARFRAME_ART[world] ?? ""}/><div><h4>{label(`world.${world}`)}</h4><span>{stale && cycle ? label("reported") : "\u00a0"}</span><strong>{cycle ? label(`state.${cycle.state}`) : label("waiting")}</strong>{cycle && <time dateTime={new Date(cycle.expiry).toISOString()} title={date(cycle.expiry)}>{ends(cycle.expiry)}</time>}</div></article>;
      })}</div>
      <div className="games-warframe-minor-cycles">{["earth", "zariman"].map(world => {
        const cycle = usable ? data.cycles.find(cycle => cycle.world === world && warframeActive(cycle, now)) : undefined;
        return <div key={world}><span>{label(`world.${world}`)}</span><strong>{cycle ? label(`state.${cycle.state}`) : label("waiting")}</strong>{cycle && <time dateTime={new Date(cycle.expiry).toISOString()} title={date(cycle.expiry)}>{ends(cycle.expiry)}</time>}</div>;
      })}</div>
      <div className="games-warframe-preparation">
        <article className="games-warframe-trader"><GameArt src={WARFRAME_BARO_ART} className="games-warframe-trader-art"/><span>{label("trader")}</span><h3>Baro Ki’Teer</h3>{trader ? <><p>{trader.location}</p><strong>{ends(visiting ? trader.expiry : trader.activation, visiting ? "leaves" : "arrival")}</strong><time dateTime={new Date(trader.activation).toISOString()}>{date(trader.activation)}</time>
          {visiting && trader.inventory.length ? <details><summary>{label("inventory")}<ChevronDown size={16}/></summary><ul>{trader.inventory.map(item => <li key={item.item}><b>{item.item}</b><span>{t("games.warframe.ducats", {count:item.ducats.toLocaleString(language)})} · {t("games.warframe.credits", {count:item.credits.toLocaleString(language)})}</span></li>)}</ul></details> : <p className="games-warframe-status">{label("inventoryPending")}</p>}
        </> : <p className="games-warframe-status">{label("waiting")}</p>}</article>
        <div className="games-warframe-operations"><Operation title={label("sortie")} emblem="/games/warframe/sortie.png" operation={usable ? data.sortie : null} now={now}/><Operation title={label("archon")} emblem="/games/warframe/narmer.svg" operation={usable ? data.archon : null} now={now}/></div>
      </div>
      <div className="games-warframe-section-heading"><h3>{label("fissures")}</h3></div>
      <div className="games-warframe-filters"><div className="games-warframe-filter"><span aria-hidden="true">{label("tier")}</span><Dropdown value={tier} ariaLabel={label("tier")} options={[{value:"all", label:label("all")}, ...tiers.map((name,index) => ({value:String(index+1),label:name}))]} onChange={value => {setTier(value);setLimit(8);}}/></div><div className="games-warframe-filter"><span aria-hidden="true">{label("mode")}</span><Dropdown value={mode} ariaLabel={label("mode")} options={["all","normal","steel","storm"].map(value => ({value,label:label(value)}))} onChange={value => {setMode(value);setLimit(8);}}/></div>
        <label className="games-warframe-search" data-tv-focus-container><Search size={16}/><input type="search" aria-label={label("search")} placeholder={label("search")} value={query} maxLength={100} spellCheck={false} autoComplete="off" onChange={event => {setQuery(event.target.value);setLimit(8);}}/></label></div>
      {fissures.length ? <ul className="games-warframe-fissures">{fissures.slice(0,limit).map(fissure => <li key={fissure.id} data-fissure={fissure.id}><span className="games-warframe-tier">{WARFRAME_RELIC_ART[fissure.tier - 1] ? <GameArt src={WARFRAME_RELIC_ART[fissure.tier - 1]!}/> : <WarframeEmblem src="/games/warframe/relic.svg"/>}<span>{tiers[fissure.tier-1]}</span></span><div><strong>{fissure.node}</strong><p>{fissure.type} · <span className="games-warframe-enemy"><WarframeEmblem src={warframeFactionArt(fissure.enemy)}/>{fissure.enemy}</span>{fissure.hard ? ` · ${label("steel")}` : ""}{fissure.storm ? ` · ${label("storm")}` : ""}</p></div><time dateTime={new Date(fissure.expiry).toISOString()} title={date(fissure.expiry)}>{ends(fissure.expiry)}</time></li>)}</ul> : <p className="games-warframe-status">{label(usable ? "noMatches" : "waiting")}</p>}
      {fissures.length > limit && <button className="games-warframe-more" onClick={() => setLimit(value => value + 16)}>{label("more")}</button>}
    </>}
    <footer><a href={sourceUrl} target="_blank" rel="noreferrer" onClick={event => {event.preventDefault();openUrl(sourceUrl);}}>{data?.source === "official" ? "Digital Extremes" : "WarframeStatus"}<ArrowUpRight size={14}/></a>{data?.source === "official" && <a href="https://github.com/WFCD/warframe-worldstate-data" target="_blank" rel="noreferrer" onClick={event => {event.preventDefault();openUrl("https://github.com/WFCD/warframe-worldstate-data");}}>Warframe Community Developers<ArrowUpRight size={14}/></a>}{data && <span>{t("games.warframe.snapshot", {date:date(data.timestamp)})}</span>}<p>{label("scope")}</p></footer>
  </section>;
}
function Operation({ title, emblem, operation, now }: { title: string; emblem: string; operation: WarframeOperation | null; now: number }) {
  const t = useT(), language = useUiLanguage(), current = warframeActive(operation, now) ? operation : null;
  return <article className="games-warframe-operation"><header><WarframeEmblem src={emblem}/><div><h3>{title}</h3>{current && <div className="games-warframe-operation-meta"><strong>{current.boss}</strong><time title={new Date(current.expiry).toLocaleString(language)}>{t("games.warframe.ends", {time:duration(current.expiry, now, language)})}</time></div>}</div></header>{current ? <><ol>{current.missions.map((mission,index) => <li key={`${index}:${mission.node}`}><span>{index+1}</span><div><strong>{mission.node}</strong><p>{mission.type}</p>{mission.modifier && <details><summary>{mission.modifier}<ChevronDown size={13}/></summary><p>{mission.description}</p></details>}</div></li>)}</ol></> : <p className="games-warframe-status">{t("games.warframe.waiting")}</p>}</article>;
}

function WarframeEmblem({ src }: { src: string }) {
  return src ? <span className="games-warframe-emblem" aria-hidden="true" style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}/> : null;
}
