import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadOsrsHistory, loadOsrsItems, loadOsrsLatest } from "@/lib/games/osrs";
import { OSRS_RANGES, osrsChartPaths, type OsrsHistory as OsrsHistoryData, type OsrsItem, type OsrsLatest, type OsrsRange } from "@/lib/games/osrs-data";
import { GameArt } from "./game-art";
import "./game-osrs-companion.css";

const quick = [4151, 385, 2434, 561];
function OsrsLoading() { const t = useT(); return <div className="games-osrs-loading" role="status" aria-label={t("common.loading")}>{[0, 1, 2].map(n => <i key={n}/>)}</div>; }
export function GameOsrsCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.osrs.${key}`), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [items, setItems] = useState<OsrsItem[]>([]), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [query, setQuery] = useState(""), [membership, setMembership] = useState("all"), [selected, setSelected] = useState(4151), [count, setCount] = useState(24);
  useEffect(() => { if (!active || !root.current) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setVisible(true); }, { rootMargin: "200px" }); observer.observe(root.current); return () => observer.disconnect(); }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController(); setFailed(false);
    void loadOsrsItems(request.signal).then(value => { if (!request.signal.aborted) setItems(value.data); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [active, visible, retry]);
  const filtered = useMemo(() => items.filter(item => (membership === "all" || item.members === (membership === "members")) && item.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, "en")), [items, query, membership]);
  const item = items.find(row => row.id === selected), shown = filtered.slice(0, count);
  return <section className="games-osrs" ref={root} aria-label={label("title")}>
    <header><p>OLD SCHOOL RUNESCAPE</p><h2>{label("title")}</h2><span>{label("intro")}</span></header>
    {language !== "en" && <p className="games-osrs-note">{label("english")}</p>}
    {failed ? <p role="status">{label("itemsFailed")} <button className="games-button" onClick={() => setRetry(n => n + 1)}>{t("common.retry")}</button></p> : !items.length ? <OsrsLoading/> : <div className="games-osrs-workspace">
      <div className="games-osrs-catalog"><div className="games-osrs-search"><Search size={17}/><input type="search" aria-label={label("search")} placeholder={label("search")} maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setCount(24); }}/></div>
        <Dropdown value={membership} ariaLabel={label("membership")} onChange={value => { setMembership(value); setCount(24); }} options={["all", "free", "members"].map(value => ({ value, label: label(`membership.${value}`) }))}/>
        {!query && membership === "all" && <div className="games-osrs-picks"><h3>{label("quick")}</h3>{quick.map(id => items.find(row => row.id === id)).filter((row): row is OsrsItem => !!row).map(row => <button key={row.id} aria-label={row.name} aria-pressed={row.id === selected} onClick={() => setSelected(row.id)}><GameArt src={row.icon}/><span>{row.name}</span></button>)}</div>}
        <div className="games-osrs-item-count">{t("games.osrs.count", { count: filtered.length.toLocaleString(language) })}</div>
        <div className="games-osrs-items">{shown.map(row => <button key={row.id} data-osrs-item={row.id} aria-pressed={row.id === selected} onClick={() => setSelected(row.id)}><GameArt src={row.icon}/><span dir="auto">{row.name}</span></button>)}</div>
        {!shown.length && <p>{label("noItems")}</p>}
        {shown.length < filtered.length && <button className="games-button" onClick={() => setCount(n => n + 24)}>{label("more")}<ChevronDown size={15}/></button>}
      </div>
      <div className="games-osrs-reader">{item && <OsrsItemMarket key={item.id} item={item} active={active}/>}</div>
    </div>}
    <footer><OsrsLink href="https://prices.runescape.wiki/osrs">OSRS Wiki · RuneLite</OsrsLink><OsrsLink href="https://creativecommons.org/licenses/by-nc-sa/3.0/">CC BY-NC-SA 3.0</OsrsLink><span>RuneScape © Jagex</span></footer>
  </section>;
}
function OsrsLink({ href, children }: { href: string; children: ReactNode }) { return <a href={href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(href); }}>{children}<ArrowUpRight size={13}/></a>; }
function OsrsItemMarket({ item, active }: { item: OsrsItem; active: boolean }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.osrs.${key}`), number = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 2 }), date = (at: number) => new Date(at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" });
  const [prices, setPrices] = useState<OsrsLatest | null>(null), [priceFailed, setPriceFailed] = useState(false), [priceBusy, setPriceBusy] = useState(false), [attempt, setAttempt] = useState(0), [range, setRange] = useState<OsrsRange>("24h");
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); setPriceBusy(true); setPriceFailed(false);
    void loadOsrsLatest(item.id, request.signal).then(value => { if (!request.signal.aborted) setPrices(value.data); }, () => { if (!request.signal.aborted) setPriceFailed(true); }).finally(() => { if (!request.signal.aborted) setPriceBusy(false); });
    return () => request.abort();
  }, [active, item.id, attempt]);
  return <article><div className="games-osrs-item-heading"><GameArt src={item.icon} eager/><div><span>{label(item.members ? "membership.members" : "membership.free")}</span><h3 dir="auto">{item.name}</h3><p dir="auto">{item.examine}</p></div></div>
    <dl className="games-osrs-facts">{item.limit !== null && <div><dt>{label("limit")}</dt><dd>{number(item.limit)}</dd></div>}{item.alchemy !== null && <div><dt>{label("alchemy")}</dt><dd>{number(item.alchemy)} {label("gp")}</dd></div>}</dl>
    <div className="games-osrs-price-heading"><h4>{label("latest")}</h4><button className="games-button" aria-label={label("refresh")} disabled={priceBusy} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16} className={priceBusy ? "games-osrs-spin" : ""}/></button></div>
    {priceFailed && <p role="status">{label("pricesFailed")} <button className="games-button" disabled={priceBusy} onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
    {!prices && !priceFailed && <OsrsLoading/>}
    {prices && <div className="games-osrs-quotes">{(["high", "low"] as const).map(side => <div key={side}><span>{label(side === "high" ? "buy" : "sell")}</span><strong>{prices[side] ? number(prices[side].price) : "—"}<small>{label("gp")}</small></strong><time dateTime={prices[side] ? new Date(prices[side].at).toISOString() : undefined}>{prices[side] ? date(prices[side].at) : label("unseen")}</time></div>)}</div>}
    <p className="games-osrs-note">{label("observed")}</p>
    <div className="games-osrs-history-heading"><h4>{label("history")}</h4><Dropdown ariaLabel={label("period")} value={range} onChange={value => setRange(value as OsrsRange)} options={OSRS_RANGES.map(value => ({ value, label: label(`range.${value}`) }))}/></div>
    <OsrsHistory key={range} item={item.id} range={range} active={active}/>
    <div className="games-osrs-links"><OsrsLink href={`https://prices.runescape.wiki/osrs/item/${item.id}`}>{label("openPrices")}</OsrsLink><OsrsLink href={`https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.id}`}>{label("wiki")}</OsrsLink></div>
  </article>;
}
function OsrsHistory({ item, range, active }: { item: number; range: OsrsRange; active: boolean }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.osrs.${key}`), [data, setData] = useState<OsrsHistoryData | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); setFailed(false);
    void loadOsrsHistory(item, range, request.signal, retry > 0).then(value => { if (!request.signal.aborted) setData(value.data); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [active, item, range, retry]);
  return <div>{failed && <p role="status">{label("historyFailed")} <button className="games-button" onClick={() => setRetry(n => n + 1)}>{t("common.retry")}</button></p>}{!data && !failed && <OsrsLoading/>}{data && (data.points.some(p => p.high !== null || p.low !== null) ? <OsrsPriceChart key={`${data.start}:${data.end}`} data={data}/> : <p>{label("noHistory")}</p>)}{data && <p className="games-osrs-note">{t("games.osrs.interval", { minutes: (data.step / 60_000).toLocaleString(language) })}</p>}</div>;
}
function OsrsPriceChart({ data }: { data: OsrsHistoryData }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.osrs.${key}`), [index, setIndex] = useState(data.points.length - 1), point = data.points[index], number = (n: number | null) => n === null ? "—" : n.toLocaleString(language, { maximumFractionDigits: 2 }), date = (at: number) => new Date(at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" });
  const high = osrsChartPaths(data, "high", 600, 180), low = osrsChartPaths(data, "low", 600, 180), values = data.points.flatMap(row => [row.high, row.low]).filter((n): n is number => n !== null);
  return <div className="games-osrs-chart">
    <div className="games-osrs-chart-values"><time>{date(point.at)}</time><div><span className="games-osrs-buy">{label("averageBuy")} <strong>{number(point.high)}</strong></span><span className="games-osrs-sell">{label("averageSell")} <strong>{number(point.low)}</strong></span></div></div>
    <div className="games-osrs-plot" dir="ltr"><div className="games-osrs-axis"><span>{number(Math.min(...values))} – {number(Math.max(...values))} {label("gp")}</span></div><svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={label("chart")} onPointerMove={event => { const r = event.currentTarget.getBoundingClientRect(), at = data.start + Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)) * (data.end - data.start); let nearest = 0; data.points.forEach((p, n) => { if (Math.abs(p.at - at) < Math.abs(data.points[nearest].at - at)) nearest = n; }); setIndex(nearest); }}>
      <path className="games-osrs-grid" d="M0 0H600 M0 90H600 M0 180H600"/>{high.map((d, n) => <path key={`h${n}`} className="games-osrs-buy-line" d={d}/>)}{low.map((d, n) => <path key={`l${n}`} className="games-osrs-sell-line" d={d}/>)}<line className="games-osrs-cursor" x1={(point.at - data.start) / (data.end - data.start) * 600} x2={(point.at - data.start) / (data.end - data.start) * 600} y1={0} y2={180}/>
    </svg></div>
    <input type="range" min={0} max={data.points.length - 1} value={index} aria-label={label("observation")} aria-valuetext={`${date(point.at)} · ${label("averageBuy")} ${number(point.high)} · ${label("averageSell")} ${number(point.low)}`} onChange={event => setIndex(Number(event.target.value))} dir="ltr"/>
    <div className="games-osrs-chart-dates"><span>{date(data.start)}</span><span>{date(data.end)}</span></div>
    <p className="games-osrs-note">{label("averages")}</p>
    <details><summary>{label("table")}<ChevronDown size={15}/></summary><div className="games-osrs-table"><table><thead><tr><th>{label("time")}</th><th>{label("averageBuy")}</th><th>{label("averageSell")}</th><th>{label("volume")}</th></tr></thead><tbody>{data.points.slice(-24).reverse().map(p => <tr key={p.at}><td>{date(p.at)}</td><td>{number(p.high)}</td><td>{number(p.low)}</td><td>{number(p.highVolume + p.lowVolume)}</td></tr>)}</tbody></table></div></details>
  </div>;
}
