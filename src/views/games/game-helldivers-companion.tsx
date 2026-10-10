import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Globe2, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { CompanionObservation } from "@/lib/games/companion-request";
import { loadHelldiversCampaigns, loadHelldiversGalaxy, loadHelldiversOrders } from "@/lib/games/helldivers";
import { HELLDIVERS_FACTIONS, HELLDIVERS_SOURCE, HELLDIVERS_STALE, HELLDIVERS_TTL, helldiversCampaigns, helldiversFactionArt, helldiversProgress, helldiversRegionArt, type HelldiversCampaign, type HelldiversCampaigns, type HelldiversFaction, type HelldiversGalaxy, type HelldiversOrders } from "@/lib/games/helldivers-data";
import { HelldiversMap } from "./game-helldivers-map";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-helldivers-companion.css";

export function GameHelldiversCompanion({ active, logo }: { active: boolean; logo?: string }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), label = (key: string) => t(`games.helldivers.${key}`);
  const [visible, setVisible] = useState(false), [activated, setActivated] = useState(false), [attempt, setAttempt] = useState(0), [now, setNow] = useState(Date.now);
  const [campaigns, setCampaigns] = useState<CompanionObservation<HelldiversCampaigns> | null>(null), [orders, setOrders] = useState<CompanionObservation<HelldiversOrders> | null>(null);
  const [galaxy, setGalaxy] = useState<CompanionObservation<HelldiversGalaxy> | null>(null), [galaxyFailed, setGalaxyFailed] = useState(false);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [ordersFailed, setOrdersFailed] = useState(false);
  const [filter, setFilter] = useState("all"), [query, setQuery] = useState(""), [sort, setSort] = useState("players"), [selected, setSelected] = useState<number | null>(null);
  const lastAttempt = useRef(0);
  const revision = useLiveRefresh(active && visible, HELLDIVERS_TTL);
  useEffect(() => {
    if (!active) { setActivated(false); setVisible(false); return; }
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => { const shown = entries.some(entry => entry.isIntersecting); setVisible(shown); if (shown) setActivated(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !activated) return;
    const force = attempt !== lastAttempt.current; lastAttempt.current = attempt;
    const controller = new AbortController(); setBusy(true); setFailed(false); setOrdersFailed(false); setGalaxyFailed(false);
    void Promise.allSettled([
      loadHelldiversCampaigns(controller.signal, force).then(value => { if (!controller.signal.aborted) { setCampaigns(value); setNow(Date.now()); } }, () => { if (!controller.signal.aborted) setFailed(true); }),
      loadHelldiversOrders(controller.signal, force).then(value => { if (!controller.signal.aborted) setOrders(value); }, () => { if (!controller.signal.aborted) setOrdersFailed(true); }),
      loadHelldiversGalaxy(controller.signal, force).then(value => { if (!controller.signal.aborted) setGalaxy(value); }, () => { if (!controller.signal.aborted) setGalaxyFailed(true); }),
    ]).then(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [active, activated, attempt, revision]);
  useEffect(() => {
    if (!active || !visible) return;
    const timer = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 15_000);
    return () => clearInterval(timer);
  }, [active, visible]);
  const choices = helldiversCampaigns(campaigns?.data.campaigns ?? [], filter, query, sort), planet = choices.find(value => value.planet === selected) ?? choices[0];
  const date = (value: number) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  const factionName = (value: HelldiversFaction) => label(value);
  const retry = () => setAttempt(value => value + 1);
  return <section ref={root} className="games-helldivers games-inset" aria-labelledby="helldivers-title">
    <header className="games-helldivers-heading"><div>{logo && <GameArt src={logo} alt="Helldivers 2" className="games-helldivers-logo" logo/>}<h2 id="helldivers-title">{label("title")}</h2><p>{label("intro")}</p></div><button className="games-button" aria-label={label("refresh")} disabled={busy} onClick={retry}><RefreshCw size={18}/></button></header>
    {failed && <p className="games-helldivers-status" role="status">{label("unavailable")} <button className="games-button" disabled={busy} onClick={retry}>{t("common.retry")}</button></p>}
    {campaigns && now - campaigns.at > HELLDIVERS_STALE && <p className="games-helldivers-status" role="status">{label("stale")}</p>}
    {(campaigns?.data.partial || galaxy?.data.partial) && <p className="games-helldivers-status">{label("partial")}</p>}
    {galaxyFailed && <p className="games-helldivers-status" role="status">{label("mapFailed")} <button className="games-button" disabled={busy} onClick={retry}>{t("common.retry")}</button></p>}
    {!campaigns && !failed && <div className="games-helldivers-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}
    {campaigns && <>
      <div className="games-helldivers-tools"><div className="games-helldivers-factions" role="group" aria-label={label("faction")}><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{label("all")}</button>{HELLDIVERS_FACTIONS.filter(value => value !== "Humans" || campaigns.data.campaigns.some(item => item.faction === value)).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}><FactionIcon faction={value}/>{factionName(value)}</button>)}</div><label className="games-helldivers-search" data-tv-focus-container><Search size={16}/><input type="search" value={query} maxLength={100} aria-label={label("search")} placeholder={label("search")} autoComplete="off" onChange={event => setQuery(event.target.value)}/></label></div>
      {choices.length ? <>
        <div className="games-helldivers-war">
          <HelldiversMap planets={galaxy?.data.planets ?? []} campaigns={choices} selected={planet} onSelect={setSelected}/>
          <div className="games-helldivers-campaigns"><div className="games-helldivers-list-heading"><h3>{label("campaigns")} <span>{choices.length.toLocaleString(language)}</span></h3><Dropdown value={sort} onChange={setSort} ariaLabel={label("sort")} options={["players", "progress", "name"].map(value => ({ value, label: label(`sort.${value}`) }))}/></div><div className="games-helldivers-list">{choices.map(value => <button key={value.planet} data-planet={value.planet} aria-pressed={planet?.planet === value.planet} onClick={() => setSelected(value.planet)}><FactionIcon faction={value.faction}/><span><strong dir="auto">{value.name}</strong><small dir="auto">{value.sector}</small></span><span className="games-helldivers-row-count"><HelldiverIcon/>{value.players === null ? "—" : value.players.toLocaleString(language)}<span className="games-helldivers-sr"> {label("players")}</span></span></button>)}</div></div>
        </div>
        {planet && <PlanetBrief key={planet.planet} planet={planet} now={now}/>}
      </> : <p className="games-helldivers-status">{label(campaigns.data.campaigns.length ? "noMatches" : "empty")}</p>}
      <p className="games-helldivers-checked">{t("games.helldivers.checked", { date: date(campaigns.at) })}</p>
    </>}
    <details className="games-helldivers-orders"><summary><span>{label("orders")}</span><ChevronDown size={18}/></summary><div>
      {ordersFailed && <p role="status">{label("ordersFailed")} <button className="games-button" disabled={busy} onClick={retry}>{t("common.retry")}</button></p>}
      {!orders && !ordersFailed && <p role="status">{t("common.loading")}</p>}
      {orders?.data.partial && <p>{label("partial")}</p>}
      {orders && <>{!orders.data.orders.length && <p>{label("ordersEmpty")}</p>}{orders.data.orders.map(order => <article key={order.id}>{order.title && <h3 dir="auto">{order.title}</h3>}{order.briefing && <p dir="auto">{order.briefing}</p>}{order.description && order.description !== order.briefing && <p dir="auto">{order.description}</p>}{order.end && <time dateTime={new Date(order.end).toISOString()}>{t(`games.helldivers.${now < order.end ? "ends" : "ended"}`, { date: date(order.end) })}</time>}</article>)}<p className="games-helldivers-checked">{t("games.helldivers.checked", { date: date(orders.at) })}</p></>}
    </div></details>
    <footer><a href={HELLDIVERS_SOURCE} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(HELLDIVERS_SOURCE); }}>Helldivers 2 API<ArrowUpRight size={13}/></a><span>{label("source")}</span></footer>
  </section>;
}
function HelldiverIcon() { return <img className="games-helldivers-diver" src="/games/helldivers/helldiver.svg" alt="" aria-hidden="true"/>; }
function FactionIcon({ faction }: { faction: HelldiversFaction }) {
  const art = helldiversFactionArt(faction);
  return art ? <GameArt src={art} className="games-helldivers-faction"/> : <Globe2 className="games-helldivers-faction"/>;
}
function PlanetBrief({ planet, now }: { planet: HelldiversCampaign; now: number }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.helldivers.${key}`), [allRegions, setAllRegions] = useState(false);
  const percent = (value: number) => `${value.toLocaleString(language, { maximumFractionDigits: 2 })}%`;
  const progress = helldiversProgress(planet);
  const regions = [...planet.regions].sort((a, b) => Number(b.available === true) - Number(a.available === true) || (b.players ?? -1) - (a.players ?? -1));
  const date = (value: number) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  return <article className="games-helldivers-brief" aria-label={planet.name}>
    <header><FactionIcon faction={planet.faction}/><div><p>{label(planet.faction)}{planet.sector && ` · ${planet.sector}`}</p><h3 dir="auto">{planet.name}</h3></div><div className="games-helldivers-population"><strong><HelldiverIcon/>{planet.players === null ? "—" : planet.players.toLocaleString(language)}</strong><span>{label("players")}</span></div></header>
    {planet.disabled && <p className="games-helldivers-status">{label("disabled")}</p>}
    <div className="games-helldivers-brief-columns"><div>
      <div className="games-helldivers-progress"><span>{label(progress.kind)}{progress.region && <small dir="auto">{progress.region}</small>}</span><strong>{progress.value === null ? "—" : percent(progress.value)}</strong>{progress.value !== null && <progress max={100} value={progress.value} aria-label={label(progress.kind)}/>}</div>
      {!planet.event && planet.recovery !== null && <p className="games-helldivers-recovery">{t("games.helldivers.recovery", { rate: percent(planet.recovery) })}<small>{label("recoveryNote")}</small></p>}
      {planet.event && <div className="games-helldivers-event"><strong>{label("event")}</strong>{planet.event.remaining !== null && <p>{t("games.helldivers.eventHealth", { percent: percent(planet.event.remaining) })}</p>}{planet.event.end && <time dateTime={new Date(planet.event.end).toISOString()}>{t(`games.helldivers.${now < planet.event.end ? "ends" : "ended"}`, { date: date(planet.event.end) })}</time>}</div>}
      {!!regions.length && <div className="games-helldivers-regions"><h4>{label("regions")}</h4>{(allRegions ? regions : regions.slice(0, 4)).map(region => <div key={region.id}>{helldiversRegionArt(region.size) && <GameArt src={helldiversRegionArt(region.size)} className="games-helldivers-region-art"/>}<div className="games-helldivers-region-name"><strong dir="auto">{region.name}</strong><span>{region.size && `${label(`size.${region.size}`)} · `}{label(region.available === null ? "availabilityUnknown" : region.available ? "available" : "locked")}{region.players !== null && ` · ${t("games.helldivers.regionPlayers", { count: region.players.toLocaleString(language) })}`}</span></div><span>{region.available === false && region.liberated === 0 ? <small>{label("notStarted")}</small> : <>{region.liberated === null ? "—" : percent(region.liberated)}<small>{label("liberated")}</small></>}</span></div>)}{regions.length > 4 && <button className="games-button" aria-expanded={allRegions} onClick={() => setAllRegions(value => !value)}>{label(allRegions ? "less" : "allRegions")}</button>}</div>}
    </div><div className="games-helldivers-conditions"><h4>{label("conditions")}</h4>{planet.biome && <div><strong dir="auto">{planet.biome.name}</strong><p dir="auto">{planet.biome.description}</p></div>}{planet.hazards.map((hazard, index) => <div key={`${hazard.name}:${index}`}><strong dir="auto">{hazard.name}</strong><p dir="auto">{hazard.description}</p></div>)}{!planet.biome && !planet.hazards.length && <p>{label("conditionsEmpty")}</p>}</div></div>
  </article>;
}
