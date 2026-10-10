import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Heart, LayoutGrid, RefreshCw, Search, TrendingUp, ListOrdered } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useSectionBack } from "@/lib/section-back";
import { loadLeagueCatalog, loadLeagueMeta } from "@/lib/games/league";
import { leagueDisplayPatch, LEAGUE_ROLES, matchLeagueChampion, normalizeChampion, roleIcon, type LeagueChampion, type LeagueRole } from "@/lib/games/league-data";
import { GameArt } from "./game-art";
import { HackVideoProvider } from "./game-hack-video";
import { LeagueChampionView } from "./game-league-champion";
import { useLeagueFeed } from "./use-league-feed";
import "./game-league-companion.css";
import { LeagueTierList } from "./game-league-tiers";

export function LeagueLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); void openUrl(href); }}>{children}<ArrowUpRight size={14}/></a>;
}
export function LeagueStatus({ failed, busy, retry }: { failed: boolean; busy: boolean; retry: () => void }) {
  const t = useT();
  return failed ? <p className="league-status" role="status">{t("games.league.unavailable")} <button disabled={busy} onClick={retry}>{t("common.retry")}</button></p> : busy ? <p className="league-status" role="status">{t("common.loading")}</p> : null;
}
function readPool(profile: string): number[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(`harbor.league.pool:${encodeURIComponent(profile)}`) ?? "[]"); return Array.isArray(value) ? [...new Set(value.filter((v): v is number => Number.isInteger(v) && v > 0))].slice(0, 100) : []; } catch { return []; }
}
export function GameLeagueCompanion({ active, profile }: { active: boolean; profile: string }) {
  const language = useUiLanguage();
  return <HackVideoProvider active={active}><Companion key={`${profile}:${language}`} active={active} profile={profile} language={language}/></HackVideoProvider>;
}
function Companion({ active, profile, language }: { active: boolean; profile: string; language: string }) {
  const t = useT(), root = useRef<HTMLElement>(null), [engaged, setEngaged] = useState(false), [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState("meta"), [role, setRole] = useState<LeagueRole>("mid"), [query, setQuery] = useState(""), [sort, setSort] = useState("tier"), [limit, setLimit] = useState(8), [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<LeagueChampion | null>(null), [pool, setPool] = useState(() => readPool(profile));
  const restore = useRef<{ element: HTMLElement | null; scroll: HTMLElement | null; top: number }>({ element: null, scroll: null, top: 0 });
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) setEngaged(true); }, { rootMargin: "240px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  const catalog = useLeagueFeed(`catalog:${language}`, active && engaged, attempt, (signal, refresh) => loadLeagueCatalog(language, signal, refresh));
  const meta = useLeagueFeed("meta", active && engaged, attempt, loadLeagueMeta);
  const champions = catalog.data?.champions ?? [];
  const save = (id: number) => setPool(previous => { const next = previous.includes(id) ? previous.filter(v => v !== id) : [...previous, id].slice(-100); try { localStorage.setItem(`harbor.league.pool:${encodeURIComponent(profile)}`, JSON.stringify(next)); } catch { /* Session pool remains usable. */ } return next; });
  const choose = (champion: LeagueChampion, selectedRole = role) => {
    const scroll = root.current?.closest<HTMLElement>(".games-view") ?? root.current?.closest("main") ?? null;
    if (!selection) restore.current = { element: document.activeElement as HTMLElement | null, scroll, top: scroll?.scrollTop ?? 0 };
    setRole(selectedRole); setSelection(champion);
    requestAnimationFrame(() => { root.current?.scrollIntoView({ block: "start", behavior: "instant" }); root.current?.querySelector<HTMLElement>(".league-champion-title")?.focus({ preventScroll: true }); });
  };
  const back = () => { setSelection(null); requestAnimationFrame(() => { const prior = restore.current; if (prior.scroll) prior.scroll.scrollTop = prior.top; const target = prior.element?.isConnected ? prior.element : root.current?.querySelector<HTMLElement>(`[data-league-id="${selection?.id}"]`); target?.focus({ preventScroll: true }); }); };
  useSectionBack(back, active && !!selection);
  const joined = (meta.data ?? []).flatMap(item => { const champion = matchLeagueChampion(champions, item.champion); return champion ? [{ ...item, championData: champion }] : []; });
  const filtered = joined.filter(item => item.role === role && normalizeChampion(`${item.champion} ${item.championData.name}`).includes(normalizeChampion(query))).sort((a, b) => sort === "win" ? b.winRate - a.winRate : sort === "picks" ? b.games - a.games : a.rank - b.rank);
  const featured = !expanded && !query && sort === "tier" ? filtered[0] : undefined;
  const roster = champions.filter(c => (tab !== "pool" || pool.includes(c.id)) && normalizeChampion(`${c.name} ${c.key}`).includes(normalizeChampion(query))).sort((a, b) => a.name.localeCompare(b.name, language));
  const numeric = new Intl.NumberFormat(language), percent = (n: number, digits = 1) => new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: digits }).format(n);
  const retry = () => setAttempt(n => n + 1);
  return <section className="league games-inset" ref={root} aria-label={t("games.league.title")}>
    {selection && catalog.data ? <><button className="league-back" onClick={back}><ArrowLeft size={18}/>{t("games.league.back")}</button><LeagueChampionView key={selection.id} champion={selection} champions={champions} patch={catalog.data.patch} language={language} active={active} role={role} setRole={setRole} saved={pool.includes(selection.id)} save={() => save(selection.id)} choose={champion => choose(champion)}/></> : null}<div hidden={!!selection}>
      <header className="league-heading"><div><p className="league-eyebrow">League of Legends</p><h2>{t("games.league.title")}</h2><p>{t("games.league.intro")}</p></div><div className="league-heading-actions"><LeagueLink href="https://www.leagueoflegends.com/en-us/news/tags/patch-notes/"><BookOpen size={16}/>{t("games.league.patchNotes")}</LeagueLink><HoverTooltip label={t("games.league.refresh")}><button className="games-icon-button" disabled={catalog.busy || meta.busy} aria-label={t("games.league.refresh")} onClick={retry}><RefreshCw size={17}/></button></HoverTooltip></div></header>
      <div className="league-toolbar"><div className="league-tabs" role="group" aria-label={t("games.league.browse")}>{[["meta", TrendingUp], ["tierList", ListOrdered], ["champions", LayoutGrid], ["pool", Heart]].map(([key, Icon]) => { const value = key as string, Mark = Icon as typeof Heart; return <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setLimit(24); }}><Mark size={17}/>{t(`games.league.${value}`)}{value === "pool" && pool.length > 0 && <small>{pool.length}</small>}</button>; })}</div><label className="league-search" data-nav-focus-container><Search size={17}/><input value={query} onChange={e => { setQuery(e.target.value); setLimit(24); }} placeholder={t("games.league.search")} aria-label={t("games.league.search")}/></label></div>
      {tab === "meta" && <><div className="league-role-bar"><div className="league-roles" role="group" aria-label={t("games.league.role")}>{LEAGUE_ROLES.map(value => <button key={value} aria-pressed={role === value} onClick={() => { setRole(value); setLimit(8); setExpanded(false); }}><GameArt src={roleIcon(value)}/>{t(`games.league.role.${value}`)}</button>)}</div><Dropdown value={sort} onChange={setSort} ariaLabel={t("games.league.sort")} options={["tier", "win", "picks"].map(v => ({ value: v, label: t(`games.league.sort.${v}`) }))}/></div>
        <LeagueStatus failed={meta.failed || catalog.failed} busy={meta.busy || catalog.busy} retry={retry}/>
        {filtered.length > 0 && <div className={`league-meta-layout${featured ? "" : " league-meta-full"}`}>
          {featured && <button className="league-spotlight" data-league-id={featured.championData.id} onClick={() => choose(featured.championData)}><GameArt eager src={featured.championData.splash} fallback={featured.championData.portrait}/><div className="league-spotlight-copy"><span>{t("games.league.topPick", { role: t(`games.league.role.${role}`) })}</span><h3>{featured.championData.name}</h3><p>{featured.championData.title}</p><div><strong>{percent(featured.winRate)}</strong><small>{t("games.league.winRate")} · {t("games.league.games", { count: numeric.format(featured.games) })}</small></div><b>{t("games.league.viewBuild")}<ArrowRight size={18}/></b></div></button>}
          <div className="league-ranking"><div className="league-ranking-heading"><h3>{t("games.league.lanePicks")}</h3><small>OP.GG</small></div><div className="league-rank-labels" aria-hidden="true"><span>{t("games.league.champion")}</span><span>{t("games.league.winRate")}</span><span>{t("games.league.pickRate")}</span></div>{filtered.slice(0, featured ? 6 : limit).map(item => <button className="league-rank-row" key={item.championData.id} data-league-id={item.championData.id} onClick={() => choose(item.championData)}><span className="league-rank-number">{item.rank}</span><GameArt src={item.championData.portrait}/><span className="league-rank-name"><strong>{item.championData.name}</strong><small>{t("games.league.games", { count: numeric.format(item.games) })}</small></span><span className="league-tier">{t("games.league.tier", { tier: item.tier })}</span><span className="league-rate">{percent(item.winRate)}</span><span className="league-rate league-pick-rate">{percent(item.pickRate, 0)}</span><ChevronRight size={16}/></button>)}{(featured || filtered.length > limit) && <button className="league-view-all" onClick={() => { setExpanded(true); setLimit(filtered.length); }}>{t("games.league.allRole", { role: t(`games.league.role.${role}`) })}<ArrowRight size={16}/></button>}</div>
        </div>}
        {!filtered.length && !meta.busy && !catalog.busy && !meta.failed && !catalog.failed && <p className="league-status">{t("games.league.empty")}</p>}
        {meta.data && <footer className="league-source"><span>{t("games.league.defaultSample")}</span>{meta.at > 0 && <span>{t("games.league.checked", { time: new Date(meta.at).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" }) })}</span>}<LeagueLink href={`https://op.gg/lol/champions?position=${role}`}>{t("games.league.source")}</LeagueLink><details><summary>{t("games.league.aboutData")}</summary><p>{t("games.league.metaScope")}</p></details></footer>}
      </>}
      {tab === "tierList" && <><LeagueStatus failed={catalog.failed} busy={catalog.busy} retry={retry}/><LeagueTierList active={active && engaged && !selection} champions={champions} query={query} language={language} choose={choose}/></>}
      {(tab === "champions" || tab === "pool") && <><LeagueStatus failed={catalog.failed} busy={catalog.busy} retry={retry}/><div className="league-roster-heading"><h3>{t(tab === "pool" ? "games.league.pool" : "games.league.champions")}</h3><span>{roster.length} · {catalog.data && t("games.league.patch", { patch: leagueDisplayPatch(catalog.data.patch) })}</span></div><div className="league-roster">{roster.slice(0, limit).map(champion => <button key={champion.id} data-league-id={champion.id} onClick={() => choose(champion, joined.filter(m => m.championData.id === champion.id).sort((a, b) => b.games - a.games)[0]?.role ?? role)}><GameArt src={champion.portrait}/><strong>{champion.name}</strong><small>{champion.title}</small>{pool.includes(champion.id) && <Heart size={14} fill="currentColor"/>}</button>)}</div>{roster.length > limit && <button className="games-button league-more" onClick={() => setLimit(n => n + 24)}>{t("games.league.more")}</button>}{!roster.length && !catalog.busy && <p className="league-status">{t(tab === "pool" && !query ? "games.league.poolEmpty" : "games.league.empty")}</p>}</>}
    </div>
    <p className="league-attribution">{t("games.league.attribution")}</p>
  </section>;
}
