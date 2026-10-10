import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, RefreshCw, Search, X, LoaderCircle } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadValorantAgents, loadValorantMeta } from "@/lib/games/valorant";
import { VALORANT_NEWS, VALORANT_ROLES, rankValorantAgents, valorantMetaUrl, type ValorantAgent, type ValorantMeta, type ValorantStat } from "@/lib/games/valorant-data";
import { GameArt } from "./game-art";
import { GameTrailer } from "./game-trailer";
import { ValorantMaps, ValorantArsenal } from "./game-valorant-reference";
import "./game-valorant-companion.css";

export function ValorantLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); void openUrl(href); }}>{children}<ArrowUpRight size={14}/></a>;
}
export function GameValorantCompanion({ active, onGuides }: { active: boolean; onGuides?: () => void }) {
  const language = useUiLanguage();
  return <Companion key={language} active={active} onGuides={onGuides}/>;
}
function Companion({ active, onGuides }: { active: boolean; onGuides?: () => void }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null);
  const [engaged, setEngaged] = useState(false), [tab, setTab] = useState("meta");
  const [agents, setAgents] = useState<ValorantAgent[] | null>(null), [agentError, setAgentError] = useState(false), [agentAttempt, setAgentAttempt] = useState(0);
  const [tier, setTier] = useState(""), [map, setMap] = useState(""), [role, setRole] = useState(""), [query, setQuery] = useState(""), [sort, setSort] = useState("win"), [selection, setSelection] = useState("");
  const [meta, setMeta] = useState<{ data: ValorantMeta; at: number; key: string } | null>(null), [metaError, setMetaError] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), [expanded, setExpanded] = useState(false);
  const options = useRef<Pick<ValorantMeta, "ranks" | "maps"> | null>(null), refreshed = useRef(0);
  const filterKey = `${tier}:${map}`, current = meta?.key === filterKey ? meta : null;
  useEffect(() => {
    if (!active || !root.current || engaged) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) setEngaged(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, engaged]);
  useEffect(() => {
    if (!active || !engaged || agents) return;
    const controller = new AbortController(); setAgentError(false);
    void loadValorantAgents(language, controller.signal).then(value => { if (!controller.signal.aborted) setAgents(value.data); }, () => { if (!controller.signal.aborted) setAgentError(true); });
    return () => controller.abort();
  }, [active, engaged, language, agentAttempt, agents]);
  useEffect(() => {
    if (!active || !engaged || tab !== "meta") return;
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setBusy(true); setMetaError(false);
    void loadValorantMeta({ tier, map }, controller.signal, refresh).then(value => {
      if (!controller.signal.aborted) { options.current = value.data; setMeta({ ...value, key: filterKey }); setBusy(false); }
    }, () => { if (!controller.signal.aborted) { setMetaError(true); setBusy(false); } });
    return () => controller.abort();
  }, [active, engaged, tab, tier, map, filterKey, attempt]);
  const ranked = useMemo(() => rankValorantAgents(agents ?? [], current?.data ?? null, role, query, sort), [agents, current?.data, role, query, sort]);
  const selected = ranked.find(v => v.agent.id === selection) ?? ranked[0];
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  const roles = VALORANT_ROLES.map(value => ({ value, agent: agents?.find(a => a.role === value) }));
  const changeMap = (value: string) => { setMap(value); setSelection(""); setExpanded(false); };
  return <section ref={root} className="games-valorant games-inset" aria-labelledby="valorant-heading">
    <header className="games-valorant-heading"><div><span className="games-valorant-logo" role="img" aria-label="VALORANT"/><h2 id="valorant-heading">{t("games.valorant.title")}</h2></div><div className="games-valorant-heading-actions"><ValorantLink href={VALORANT_NEWS}>{t("games.valorant.patchNotes")}{current && <span>{current.data.patch}</span>}</ValorantLink>{onGuides && <button onClick={onGuides}><BookOpen size={17}/>{t("games.valorant.guides")}</button>}</div></header>
    <div className="games-valorant-tabs" role="group" aria-label={t("games.valorant.browse")}>{["meta", "maps", "arsenal"].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(`games.valorant.${value}`)}</button>)}</div>
    <div hidden={tab !== "meta"}>
      <div className="games-valorant-tools">
        <Dropdown ariaLabel={t("games.valorant.rank")} value={tier} options={(options.current?.ranks ?? [{ value: "", label: "", icon: "" }]).map(o => ({ ...o, label: o.value ? o.label : t("games.valorant.allRanks"), left: o.icon ? <GameArt src={o.icon} className="games-valorant-option-icon"/> : undefined }))} onChange={value => { setTier(value); setSelection(""); }}/>
        <Dropdown ariaLabel={t("games.valorant.map")} value={map} options={(options.current?.maps ?? [{ value: "", label: "", icon: "" }]).map(o => ({ value: o.value, label: o.value ? o.label : t("games.valorant.allMaps") }))} onChange={changeMap}/>
        <span className="games-valorant-scope">{t("games.valorant.competitive")}{current ? ` · ${current.data.patch}` : ""}</span>
        <button className="games-valorant-refresh" aria-label={t("games.valorant.refresh")} disabled={busy} onClick={() => { setAttempt(v => v + 1); if (agentError) setAgentAttempt(v => v + 1); }}><RefreshCw size={17}/></button>
      </div>
      <div className="games-valorant-roster-tools"><div className="games-valorant-roles" role="group" aria-label={t("games.valorant.role")}><button aria-pressed={!role} onClick={() => setRole("")}>{t("games.valorant.all")}</button>{roles.map(({ value, agent }) => <button key={value} aria-pressed={role === value} onClick={() => setRole(value)}>{agent && <GameArt src={agent.roleIcon}/>}<span>{agent?.roleName ?? t(`games.valorant.${value.toLowerCase()}`)}</span></button>)}</div><label className="games-valorant-search" data-tv-focus-container><Search size={16}/><input type="search" value={query} maxLength={80} autoComplete="off" aria-label={t("games.valorant.search")} placeholder={t("games.valorant.search")} onChange={e => setQuery(e.target.value)}/></label></div>
      {agentError && <p className="games-valorant-status" role="status">{t("games.valorant.referenceError")} <button onClick={() => setAgentAttempt(v => v + 1)}>{t("common.retry")}</button></p>}
      {metaError && <p className="games-valorant-status" role="status">{t(current ? "games.valorant.stale" : "games.valorant.metaError")} <button onClick={() => setAttempt(v => v + 1)}>{t("common.retry")}</button></p>}
      {(!agents && !agentError) || (!current && !metaError) ? <div className="games-valorant-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><div>{Array.from({ length: 6 }, (_, i) => <i key={i} className="games-detail-skeleton"/>)}</div></div> : selected ? <>
        <div className="games-valorant-meta-layout">
          <AgentSpotlight agent={selected.agent} stats={selected.stats} format={number} busy={busy && !current}/>
          <div className="games-valorant-ranking"><div className="games-valorant-ranking-heading"><h3>{t("games.valorant.agents")}</h3><Dropdown ariaLabel={t("games.valorant.sort")} value={sort} options={[{ value: "win", label: t("games.valorant.winSort") }, { value: "pick", label: t("games.valorant.pickSort") }]} onChange={setSort} size="sm"/></div>
            <div className="games-valorant-columns"><span>{t("games.valorant.agent")}</span><span>{t("games.valorant.win")}</span><span>{t("games.valorant.pick")}</span></div>
            <div className="games-valorant-ranking-list" aria-busy={busy}>{ranked.slice(0, expanded ? ranked.length : 7).map(({ agent, stats }, i) => <button key={agent.id} className="games-valorant-agent-row" aria-label={agent.name} aria-pressed={selected.agent.id === agent.id} onClick={() => setSelection(agent.id)}><span className="games-valorant-agent-row-name"><small>{String(i + 1).padStart(2, "0")}</small><GameArt src={agent.icon}/><span><strong dir="auto">{agent.name}</strong><small>{agent.roleName}</small></span></span><span>{stats ? `${number.format(stats.win)}%` : "—"}</span><span>{stats ? `${number.format(stats.pick)}%` : "—"}</span></button>)}</div>
            {ranked.length > 7 && <button className="games-valorant-more" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{t(expanded ? "games.valorant.less" : "games.valorant.allAgents", { count: ranked.length })}<ChevronDown size={15}/></button>}
            <p className="games-valorant-meta-note">{t("games.valorant.sampleNote")}</p>
          </div>
        </div>
        <AgentAbilities key={selected.agent.id} agent={selected.agent} videos={current?.data.videos[selected.agent.id]} active={active && tab === "meta"}/>
      </> : agents && <p className="games-valorant-status" role="status">{t("games.valorant.empty")}</p>}
      <footer className="games-valorant-source"><ValorantLink href={valorantMetaUrl({ tier, map })}>OP.GG</ValorantLink>{current && <span>{t("games.valorant.checked", { date: new Date(current.at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</span>}<p>{t("games.valorant.metaScope")}</p></footer>
    </div>
    <div hidden={tab !== "maps"}><ValorantMaps active={active && engaged && tab === "maps"} availableMaps={options.current?.maps.map(m => m.value) ?? []} onMeta={name => { changeMap(name); setTab("meta"); root.current?.scrollIntoView({ block: "start", behavior: "instant" }); }}/></div>
    <div hidden={tab !== "arsenal"}><ValorantArsenal active={active && engaged && tab === "arsenal"} language={language}/></div>
    <footer className="games-valorant-source"><ValorantLink href="https://valorant-api.com/">Valorant-API</ValorantLink><span>{t("games.valorant.referenceScope")}</span></footer>
  </section>;
}
function AgentSpotlight({ agent, stats, format, busy }: { agent: ValorantAgent; stats?: ValorantStat; format: Intl.NumberFormat; busy: boolean }) {
  const t = useT();
  return <article className="games-valorant-spotlight" style={{ "--agent-color": agent.color } as CSSProperties} aria-label={agent.name}>
    <div className="games-valorant-agent-art"><GameArt src={agent.background} className="games-valorant-agent-background"/><GameArt key={agent.portrait} src={agent.portrait} fallback={agent.icon} className="games-valorant-agent-portrait" eager/><span className="games-valorant-portrait-loading" role="status" aria-label={t("common.loading")}><LoaderCircle size={24} strokeWidth={1.5}/></span></div>
    <div className="games-valorant-agent-copy"><span className="games-valorant-agent-role"><GameArt src={agent.roleIcon}/>{agent.roleName}</span><h3 dir="auto">{agent.name}</h3><p dir="auto">{agent.description}</p><dl aria-busy={busy}><div><dt>{t("games.valorant.win")}</dt><dd>{stats ? `${format.format(stats.win)}%` : "—"}</dd></div><div><dt>{t("games.valorant.pick")}</dt><dd>{stats ? `${format.format(stats.pick)}%` : "—"}</dd></div>{stats?.kd !== undefined && <div><dt>K/D</dt><dd>{format.format(stats.kd)}</dd></div>}</dl>{stats && <small>{t("games.valorant.samples", { count: new Intl.NumberFormat(undefined).format(stats.games) })}{stats.games < 200 ? ` · ${t("games.valorant.smallSample")}` : ""}</small>}</div>
  </article>;
}
function AgentAbilities({ agent, videos, active }: { agent: ValorantAgent; videos?: Record<string, string>; active: boolean }) {
  const t = useT(), [slot, setSlot] = useState(agent.abilities[0]?.slot ?? ""), [watch, setWatch] = useState(false), [failed, setFailed] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const ability = agent.abilities.find(a => a.slot === slot), video = ability && videos?.[ability.slot];
  useEffect(() => { if (!active) setWatch(false); }, [active]);
  if (!ability) return null;
  return <div className="games-valorant-abilities"><div className="games-valorant-ability-picker"><h3>{t("games.valorant.abilities")}</h3><div role="group" aria-label={t("games.valorant.abilities")}>{agent.abilities.map(a => <button key={a.slot} aria-label={a.name} aria-pressed={slot === a.slot} onClick={() => { setSlot(a.slot); setWatch(false); setFailed(false); }}><GameArt src={a.icon}/><span dir="auto">{a.name}</span></button>)}</div></div><div className="games-valorant-ability-detail"><h4 dir="auto">{ability.name}</h4><p dir="auto">{ability.description}</p>{video && !watch && <button ref={trigger} className="games-valorant-text-button" onClick={() => setWatch(true)}><Play size={15}/>{t("games.valorant.watchAbility")}</button>}{watch && video && active && <div className="games-valorant-ability-video"><button className="games-valorant-close" aria-label={t("common.close")} onClick={() => { setWatch(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }}><X size={18}/></button>{failed ? <p role="status">{t("games.valorant.videoError")}</p> : <GameTrailer url={video} poster="" active={active} intentional onError={() => setFailed(true)}/>}</div>}</div></div>;
}
