import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ArrowRightLeft, Check, ChevronDown, Copy, RefreshCw, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { EVE_PREFERENCES, eveName, evePlan, evePlanKey, eveSecurity, eveSecurityClass, readEvePlan, type EveIncursion, type EveKills, type EvePlan, type EveStatus, type EveUniverse } from "@/lib/games/eve-data";
import { loadEveIncursions, loadEveKills, loadEveRoute, loadEveStatus, loadEveUniverse, type EveSnapshot } from "@/lib/games/eve";
import { EveSystemField } from "./game-eve-system-field";
import { GameArt } from "./game-art";
import "./game-eve-companion.css";

function EveLoading() { const t = useT(); return <div className="games-eve-loading" role="status" aria-label={t("common.loading")}>{[0, 1, 2].map(n => <i key={n}/>)}</div>; }
export function GameEveCompanion({ active, profile }: { active: boolean; profile: string }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.eve.${key}`), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [universe, setUniverse] = useState<EveUniverse | null>(null), [universeFailed, setUniverseFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<EveSnapshot<EveStatus> | null>(null), [statusFailed, setStatusFailed] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { if (!active || !root.current) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setVisible(true); }, { rootMargin: "200px" }); observer.observe(root.current); return () => observer.disconnect(); }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController(); setUniverseFailed(false); setStatusFailed(false); setBusy(true);
    void Promise.allSettled([
      loadEveUniverse(request.signal).then(value => { if (!request.signal.aborted) setUniverse(value.data); }, () => { if (!request.signal.aborted) setUniverseFailed(true); }),
      loadEveStatus(request.signal).then(value => { if (!request.signal.aborted) setStatus(value); }, () => { if (!request.signal.aborted) setStatusFailed(true); }),
    ]).finally(() => { if (!request.signal.aborted) setBusy(false); });
    return () => request.abort();
  }, [active, visible, attempt]);
  return <section ref={root} className="games-eve" aria-label={label("title")}><header><div><p>EVE ONLINE</p><h2>{label("title")}</h2><span>{label("intro")}</span></div><div className="games-eve-status"><span>Tranquility</span>{status ? <><strong>{status.data.restricted ? label("restricted") : t("games.eve.pilots", { count: status.data.players.toLocaleString(language) })}</strong><time dateTime={new Date(status.at ?? status.receivedAt).toISOString()}>{new Date(status.at ?? status.receivedAt).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" })}</time></> : <small>{label(statusFailed ? "statusFailed" : "checking")}</small>}<button className="games-button" aria-label={label("refreshStatus")} disabled={busy} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16}/></button>{status && statusFailed && <small role="status">{label("statusFailed")}</small>}</div></header>
    {universeFailed && <p role="status">{label("universeFailed")} <button className="games-button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
    {universe ? <EveFlightPlanner universe={universe} active={active && visible} profile={profile}/> : !universeFailed && <EveLoading/>}
    <footer><a href="https://developers.eveonline.com/" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl("https://developers.eveonline.com/"); }}>CCP · ESI<ArrowUpRight size={13}/></a>{universe && <span>{t("games.eve.catalogDate", { date: new Date(universe.released).toLocaleDateString(language) })}</span>}<span>EVE Online © CCP hf.</span></footer></section>;
}
function EveFlightPlanner({ universe, active, profile }: { universe: EveUniverse; active: boolean; profile: string }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.eve.${key}`), initial = useRef(readEvePlan(profile)), form = useRef<HTMLFormElement>(null);
  const [origin, setOrigin] = useState<number | null>(initial.current.origin), [destination, setDestination] = useState<number | null>(initial.current.destination), [preference, setPreference] = useState(initial.current.preference), [avoid, setAvoid] = useState(initial.current.avoid);
  const [request, setRequest] = useState<{ plan: EvePlan; revision: number } | null>(null), [result, setResult] = useState<{ plan: EvePlan; snapshot: EveSnapshot<number[] | null> } | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [saveFailed, setSaveFailed] = useState(false), [expanded, setExpanded] = useState(false), [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
  const [kills, setKills] = useState<EveSnapshot<Map<number, EveKills>> | null>(null), [killsFailed, setKillsFailed] = useState(false), [activityBusy, setActivityBusy] = useState(false), [activityAttempt, setActivityAttempt] = useState(0);
  const [incursions, setIncursions] = useState<EveSnapshot<EveIncursion[]> | null>(null), [incursionFailed, setIncursionFailed] = useState(false), [incursionBusy, setIncursionBusy] = useState(false), [incursionAttempt, setIncursionAttempt] = useState(0);
  const name = (id: number) => eveName(universe.byId.get(id)?.names, language) || `#${id}`, date = (at: number) => new Date(at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" });
  function run(value: EvePlan) {
    const next = evePlan(value); setOrigin(next.origin); setDestination(next.destination); setPreference(next.preference); setAvoid(next.avoid); setCopied(false); setCopyFailed(false);
    try { localStorage.setItem(evePlanKey(profile), JSON.stringify(next)); setSaveFailed(false); } catch { setSaveFailed(true); }
    setRequest(previous => ({ plan: next, revision: (previous?.revision ?? 0) + 1 }));
  }
  useEffect(() => {
    if (!active || !request) return;
    const controller = new AbortController(); setBusy(true); setFailed(false);
    void loadEveRoute(request.plan, controller.signal).then(snapshot => { if (!controller.signal.aborted) { setResult({ plan: request.plan, snapshot }); setExpanded(false); } }, () => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [active, request]);
  useEffect(() => {
    if (!active || !result?.snapshot.data) return;
    const controller = new AbortController(); setKillsFailed(false); setActivityBusy(true);
    void loadEveKills(controller.signal).then(value => { if (!controller.signal.aborted) setKills(value); }, () => { if (!controller.signal.aborted) setKillsFailed(true); }).finally(() => { if (!controller.signal.aborted) setActivityBusy(false); });
    return () => controller.abort();
  }, [active, !!result?.snapshot.data, activityAttempt]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); setIncursionFailed(false); setIncursionBusy(true);
    void loadEveIncursions(controller.signal).then(value => { if (!controller.signal.aborted) setIncursions(value); }, () => { if (!controller.signal.aborted) setIncursionFailed(true); }).finally(() => { if (!controller.signal.aborted) setIncursionBusy(false); });
    return () => controller.abort();
  }, [active, incursionAttempt]);
  const route = result?.snapshot.data, shown = expanded ? route : route?.slice(0, 10);
  return <><form ref={form} className="games-eve-plan" onSubmit={event => { event.preventDefault(); if (origin !== null && destination !== null && universe.byId.has(origin) && universe.byId.has(destination)) run({ origin, destination, preference, avoid: avoid.filter(id => id !== origin && id !== destination) }); }}>
    <div className="games-eve-endpoints"><EveSystemField active={active} universe={universe} label={label("origin")} selected={origin} onChange={setOrigin}/><button type="button" className="games-button" aria-label={label("swap")} onClick={() => { setOrigin(destination); setDestination(origin); }} disabled={origin === null || destination === null}><ArrowRightLeft size={18}/></button><EveSystemField active={active} universe={universe} label={label("destination")} selected={destination} onChange={setDestination}/></div>
    <div className="games-eve-plan-actions"><Dropdown value={preference} ariaLabel={label("preference")} onChange={value => setPreference(value as EvePlan["preference"])} options={EVE_PREFERENCES.map(value => ({ value, label: label(`preference.${value}`) }))}/><button className="games-button games-button-primary" type="submit" disabled={busy || origin === null || destination === null}>{busy ? t("common.loading") : label("plot")}<ArrowRight size={17}/></button></div>
    {avoid.length > 0 && <div className="games-eve-avoids"><span>{label("avoiding")}</span>{avoid.map(id => <button type="button" key={id} aria-label={t("games.eve.allow", { name: name(id) })} onClick={() => setAvoid(previous => previous.filter(value => value !== id))}><bdi>{name(id)}</bdi><X size={13}/></button>)}<button type="button" onClick={() => setAvoid([])}>{label("clear")}</button></div>}
    <p className="games-eve-note">{label("stargates")}</p>{saveFailed && <p role="status">{label("saveFailed")}</p>}
  </form>
  {failed && <p role="status">{label("routeFailed")} <button className="games-button" disabled={busy} onClick={() => request && run(request.plan)}>{t("common.retry")}</button></p>}
  {busy && !result && <EveLoading/>}
  {!result && !busy && !failed && <p className="games-eve-prompt">{label("ready")}</p>}
  {result && <article className="games-eve-route" aria-busy={busy}><header><div><h3><bdi>{name(result.plan.origin)}</bdi><ArrowRight size={18}/><bdi>{name(result.plan.destination)}</bdi></h3><p>{label(`preference.${result.plan.preference}`)}{route && <> · {t("games.eve.jumps", { count: (route.length - 1).toLocaleString(language) })}</>}</p></div>{route && <button className="games-button" aria-label={label(copied ? "copied" : "copy")} onClick={async () => { try { await navigator.clipboard.writeText(route.map(id => universe.byId.get(id)?.names.en ?? String(id)).join(" → ")); setCopied(true); setCopyFailed(false); } catch { setCopyFailed(true); } }}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button>}</header>
    {copyFailed && <p role="status">{label("copyFailed")}</p>}
    {route ? <><div className="games-eve-activity-heading"><span>{kills?.at ? t("games.eve.hourEnding", { date: date(kills.at) }) : label(kills || killsFailed ? "timeUnavailable" : "loadingActivity")}</span><button className="games-button" aria-label={label("refreshActivity")} disabled={activityBusy} onClick={() => setActivityAttempt(n => n + 1)}><RefreshCw size={14}/></button></div>{killsFailed && <p role="status">{label("activityFailed")}</p>}
      <div className="games-eve-route-table"><div className="games-eve-route-labels"><span>{label("system")}</span><span>{label("ships")}</span><span>{label("pods")}</span><span/></div>{shown?.map((id, index) => {
        const system = universe.byId.get(id), activity = kills && id < 31_000_000 ? kills.data.get(id) ?? { ships: 0, pods: 0, npcs: 0 } : null;
        return <div className="games-eve-route-stop" data-eve-system={id} key={id}><div><span className="games-eve-step">{index === 0 ? "•" : index.toLocaleString(language)}</span><span className={`games-eve-security is-${system ? eveSecurityClass(system) : "unknown"}`} title={system ? label(`security.${eveSecurityClass(system)}`) : label("unknown")}>{system ? eveSecurity(system.security).toFixed(1) : "—"}</span><span><strong dir="auto">{name(id)}</strong><small dir="auto">{system ? eveName(universe.regions.get(system.region), language) : label("unknown")}</small></span></div><span>{activity ? activity.ships.toLocaleString(language) : "—"}</span><span>{activity ? activity.pods.toLocaleString(language) : "—"}</span>{index > 0 && index < route.length - 1 ? <button className="games-button" aria-label={t("games.eve.avoid", { name: name(id) })} disabled={busy || result.plan.avoid.length >= 1000} onClick={() => run({ ...result.plan, avoid: [...result.plan.avoid, id] })}><X size={14}/></button> : <span/>}</div>;
      })}</div>{route.length > 10 && <button className="games-button games-eve-expand" aria-expanded={expanded} onClick={() => setExpanded(previous => !previous)}>{label(expanded ? "less" : "allStops")}<ChevronDown size={15}/></button>}
      <p className="games-eve-note">{label("activityNote")}</p></> : <p role="status">{label("noRoute")}</p>}
  </article>}
  <section className="games-eve-incursions"><header><h3>{label("incursions")}</h3><button className="games-button" aria-label={label("refreshIncursions")} disabled={incursionBusy} onClick={() => setIncursionAttempt(n => n + 1)}><RefreshCw size={16}/></button></header>{incursionFailed && <p role="status">{label("incursionsFailed")}</p>}{!incursions && !incursionFailed && <EveLoading/>}{incursions && <><p className="games-eve-note">{t("games.eve.updated", { date: date(incursions.at ?? incursions.receivedAt) })}</p>{!incursions.data.length ? <p>{label("noIncursions")}</p> : <div className="games-eve-incursion-list">{incursions.data.map(row => <article key={row.constellation}><header><GameArt src={`https://images.evetech.net/corporations/${row.faction}/logo?size=128`}/><div><span>{label(`state.${row.state}`)}</span><h4 dir="auto">{eveName(universe.constellations.get(row.constellation), language) || `#${row.constellation}`}</h4></div></header><p>{label("staging")} <bdi>{name(row.staging)}</bdi></p><div className="games-eve-influence"><span>{label("influence")}</span><strong>{(row.influence * 100).toLocaleString(language, { maximumFractionDigits: 1 })}%</strong><meter min={0} max={1} value={row.influence} aria-label={label("influence")}/></div><p>{t("games.eve.systems", { count: row.systems.length.toLocaleString(language) })}{row.boss && <span> · {label("boss")}</span>}</p><button className="games-button" onClick={() => { const from = origin !== null && universe.byId.has(origin) ? origin : 30000142; run({ origin: from, destination: row.staging, preference, avoid: avoid.filter(id => id !== from && id !== row.staging) }); form.current?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}>{label("routeThere")}<ArrowRight size={15}/></button></article>)}</div>}</>}</section>
  </>;
}
