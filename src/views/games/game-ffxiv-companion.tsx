import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadXivCenters, loadXivMarket, searchXivItems } from "@/lib/games/ffxiv";
import { xivLanguage, type XivCenter, type XivItem, type XivMarket, type XivSearch } from "@/lib/games/ffxiv-data";
import type { CompanionObservation } from "@/lib/games/companion-request";
import { GameArt } from "./game-art";
import "./game-ffxiv-companion.css";

function rememberedCenter(profile: string) { try { return localStorage.getItem(`harbor.games.ffxiv.center:${profile}`) ?? ""; } catch { return ""; } }
export function GameFfxivCompanion({ active, profile }: { active: boolean; profile: string }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), label = (key: string) => t(`games.ffxiv.${key}`);
  const [visible, setVisible] = useState(false), [centers, setCenters] = useState<XivCenter[]>([]), [centerName, setCenterName] = useState(() => rememberedCenter(profile)), [directoryFailed, setDirectoryFailed] = useState(false), [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [input, setInput] = useState(""), [query, setQuery] = useState(""), [search, setSearch] = useState<XivSearch | null>(null), [searchAttempt, setSearchAttempt] = useState(0), [searchFailed, setSearchFailed] = useState(false), [searchBusy, setSearchBusy] = useState(false), [selected, setSelected] = useState<number | null>(null), [pagination, setNext] = useState<{ cursor: string; version: string; language: string; query: string }>();
  const next = pagination?.language === language && pagination.query === query ? pagination : undefined;
  const center = centers.find(row => row.name === centerName), item = search?.items.find(row => row.id === selected) ?? search?.items[0];
  useEffect(() => { if (!active || !root.current) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setVisible(true); }, { rootMargin: "200px" }); observer.observe(root.current); return () => observer.disconnect(); }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController(); setDirectoryFailed(false);
    void loadXivCenters(request.signal, directoryAttempt > 0).then(value => { if (!request.signal.aborted) setCenters(value); }, () => { if (!request.signal.aborted) setDirectoryFailed(true); });
    return () => request.abort();
  }, [active, visible, directoryAttempt]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController(); setSearchBusy(true); setSearchFailed(false);
    if (!next) { setSearch(null); setSelected(null); }
    void searchXivItems(query, language, request.signal, next).then(value => {
      if (request.signal.aborted) return;
      setSearch(previous => next && previous?.version === value.data.version ? { ...value.data, partial: previous.partial || value.data.partial, items: [...new Map([...previous.items, ...value.data.items].map(row => [row.id, row])).values()] } : value.data);
    }, () => { if (!request.signal.aborted) setSearchFailed(true); }).finally(() => { if (!request.signal.aborted) setSearchBusy(false); });
    return () => request.abort();
  }, [active, visible, query, language, searchAttempt, next]);
  const chooseCenter = (name: string) => { setCenterName(name); try { localStorage.setItem(`harbor.games.ffxiv.center:${profile}`, name); } catch { /* A session selection remains usable without persistent storage. */ } };
  return <section ref={root} className="games-ffxiv" aria-label={label("title")}>
    <header><div><p>FINAL FANTASY XIV</p><h2>{label("title")}</h2><span>{label("intro")}</span></div><div className="games-ffxiv-center"><span>{label("center")}</span><Dropdown value={center?.name ?? ""} onChange={chooseCenter} ariaLabel={label("center")} placeholder={label("chooseCenter")} options={centers.map(row => ({ value: row.name, label: `${row.name} · ${row.region}` }))}/></div></header>
    {directoryFailed && <p role="status">{label("directoryFailed")} <button className="games-button" onClick={() => setDirectoryAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    {xivLanguage(language) !== language && <p className="games-ffxiv-note">{label("english")}</p>}
    <div className="games-ffxiv-workspace"><div className="games-ffxiv-catalog">
      <form onSubmit={event => { event.preventDefault(); setNext(undefined); setQuery(input.trim()); setSearchAttempt(value => value + 1); }}><Search size={17}/><input type="search" value={input} maxLength={80} aria-label={label("search")} placeholder={label("search")} onChange={event => setInput(event.target.value)} autoComplete="off"/><button type="submit" className="games-button">{label("find")}</button></form>
      {!query && <h3>{label("crystals")}</h3>}
      {searchFailed && <p role="status">{label("searchFailed")} <button className="games-button" disabled={searchBusy} onClick={() => setSearchAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
      {search?.partial && <p className="games-ffxiv-note">{label("partial")}</p>}
      {!search && !searchFailed && <div className="games-ffxiv-skeleton" role="status" aria-label={t("common.loading")}>{[0, 1, 2, 3].map(n => <i key={n}/>)}</div>}
      {search && <div className="games-ffxiv-items" aria-label={label("items")}>{search.items.map(row => <button key={row.id} aria-pressed={row.id === item?.id} data-xiv-item={row.id} onClick={() => setSelected(row.id)}><GameArt src={row.icon}/><span><strong dir="auto">{row.name}</strong><small dir="auto">{row.category}</small></span></button>)}</div>}
      {search && !search.items.length && <p>{label("empty")}</p>}
      {search?.next && <button className="games-button games-ffxiv-more" disabled={searchBusy} onClick={() => setNext({ cursor: search.next!, version: search.version, language, query })}>{searchBusy ? t("common.loading") : label("more")}<ChevronDown size={15}/></button>}
    </div><div className="games-ffxiv-reader">{item ? <XivItemMarket key={`${item.id}:${centerName}`} item={item} center={center} active={active}/> : <p className="games-ffxiv-prompt">{label("pickItem")}</p>}</div></div>
    <footer><a href="https://universalis.app/" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl("https://universalis.app/"); }}>Universalis <ArrowUpRight size={13}/></a><span>{label("source")}</span><a href="https://v2.xivapi.com/" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl("https://v2.xivapi.com/"); }}>XIVAPI <ArrowUpRight size={13}/></a><span>FINAL FANTASY XIV © SQUARE ENIX</span></footer>
  </section>;
}
function XivItemMarket({ item, center, active }: { item: XivItem; center?: XivCenter; active: boolean }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.ffxiv.${key}`);
  const [world, setWorld] = useState<number | null>(null), [quality, setQuality] = useState("all"), [attempt, setAttempt] = useState(0), [observation, setObservation] = useState<(CompanionObservation<XivMarket> & { key: string }) | null>(null), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  const key = `${center?.name}:${item.id}:${world}:${quality}`, market = observation?.key === key ? observation : null;
  useEffect(() => {
    if (!active || !center) return;
    const request = new AbortController(); setBusy(true); setFailed(false);
    void loadXivMarket(center, item.id, world, quality, request.signal, attempt > 0).then(value => { if (!request.signal.aborted) setObservation({ ...value, key }); }, () => { if (!request.signal.aborted) setFailed(true); }).finally(() => { if (!request.signal.aborted) setBusy(false); });
    return () => request.abort();
  }, [active, key, attempt]);
  const number = (value: number) => value.toLocaleString(language), date = (at: number) => new Date(at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" });
  const source = `https://universalis.app/market/${item.id}`;
  return <article><div className="games-ffxiv-item-heading"><GameArt src={item.icon}/><div><span dir="auto">{item.category}</span><h3 dir="auto">{item.name}</h3>{item.description && <p dir="auto">{item.description}</p>}</div></div>
    {!center ? <p className="games-ffxiv-prompt">{label("chooseCenter")}</p> : <>
      <div className="games-ffxiv-market-controls"><Dropdown value={world === null ? "all" : String(world)} ariaLabel={label("world")} onChange={value => setWorld(value === "all" ? null : Number(value))} options={[{ value: "all", label: label("allWorlds") }, ...center.worlds.map(row => ({ value: String(row.id), label: row.name }))]}/><Dropdown value={quality} onChange={setQuality} ariaLabel={label("quality")} options={["all", "nq", "hq"].map(value => ({ value, label: label(`quality.${value}`) }))}/><button className="games-button" aria-label={label("refresh")} title={label("refresh")} disabled={busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} className={busy ? "games-ffxiv-spinning" : ""}/></button></div>
      {failed && <p role="status">{label("marketFailed")} <button className="games-button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
      {!market && !failed && <div className="games-ffxiv-skeleton" role="status" aria-label={t("common.loading")}>{[0, 1, 2].map(n => <i key={n}/>)}</div>}
      {market && <><div className="games-ffxiv-market-heading"><h4>{label("listings")}</h4><span>{t("games.ffxiv.checked", { date: date(market.at) })}</span></div><p className="games-ffxiv-note">{label("listingScope")}</p>
        {market.data.partial && <p>{label("partial")}</p>}
        {!!market.data.listings.length ? <div className="games-ffxiv-table"><table><thead><tr><th>{label("world")}</th><th>{label("unit")}</th><th>{label("stack")}</th><th>{label("seen")}</th></tr></thead><tbody>{market.data.listings.map((row, index) => <tr key={index}><td>{center.worlds.find(value => value.id === row.world)?.name}<small>{label(row.hq ? "quality.hq" : "quality.nq")}</small></td><td>{number(row.price)}<small>{label("gil")}</small></td><td>{number(row.quantity)}<small>{number(row.total)} {label("gil")}</small></td><td>{date(row.at)}</td></tr>)}</tbody></table></div> : <p>{label("noListings")}</p>}
        <details className="games-ffxiv-sales"><summary>{label("sales")} <ChevronDown size={16}/></summary>{market.data.sales.length ? <div className="games-ffxiv-table"><table><thead><tr><th>{label("world")}</th><th>{label("unit")}</th><th>{label("stack")}</th><th>{label("sold")}</th></tr></thead><tbody>{market.data.sales.map((row, index) => <tr key={index}><td>{center.worlds.find(value => value.id === row.world)?.name}<small>{label(row.hq ? "quality.hq" : "quality.nq")}</small></td><td>{number(row.price)}<small>{label("gil")}</small></td><td>{number(row.quantity)}</td><td>{date(row.at)}</td></tr>)}</tbody></table></div> : <p>{label("noSales")}</p>}</details>
        <p className="games-ffxiv-note">{label("community")}</p>
      </>}
    </>}
    <a className="games-ffxiv-source-link" href={source} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(source); }}>{label("open")} <ArrowUpRight size={14}/></a>
  </article>;
}
