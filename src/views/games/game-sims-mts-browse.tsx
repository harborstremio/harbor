import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowLeft, ArrowRight, ArrowUpRight, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { listen } from "@tauri-apps/api/event";

import { Dropdown } from "@/components/dropdown";

import { useT, useUiLanguage } from "@/lib/i18n";

import { openUrl } from "@/lib/window";

import { simsCancel, simsError, simsMtsBrowse, type SimsMtsPage, type SimsMtsQuery, type SimsMtsProject, type SimsProgress } from "@/lib/games/sims";

import { ModStats } from "./mod-stats";
import { ModViewToggle, useModCatalogView } from "./mod-view-toggle";
import { ModProviderLogo } from "./mod-identity";
import { SimsMtsArt } from "./game-sims-mts-art";
import { SimsDiscoveryIcon, SimsDiscoveryLoading, SimsDiscoveryProject } from "./game-sims-discovery";



const categories = [[38,"All"],[145,"Sims"],[485,"Pets"],[143,"Lots"],[342,"Cas"],[385,"Buy"],[380,"Build"],[414,"Mods"],[229,"Careers"],[747,"Traits"],[519,"Misc"],[139,"Tools"]] as const;

export function GameSimsMtsBrowse({ game = 4, profile, active, select, autoLoad = false, query = "", toolbarTarget }: { toolbarTarget?: HTMLElement | null; game?: 2 | 3 | 4; query?: string; autoLoad?: boolean; profile: string; active: boolean; select: (project: SimsMtsProject, trigger: HTMLElement) => void }) {

  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.sims.${key}`);

  const [view, setView] = useModCatalogView(`sims${game}`, "list");
  const options = categories.filter(([value]) => game === 4 || value !== 747).map(([value, key]) => ({ value: String(game === 3 && value === 485 ? 649 : value), label: value === 342 && game !== 4 ? t("games.modHub.bodyShop") : label(`mtsCat${key}`) }));

  if (game === 2) options.push({ value: "415", label: t("games.modHub.sets") });

  if (game === 3) options.push({ value: "588", label: t("games.modHub.patterns") }, { value: "508", label: t("games.modHub.themes") });

  const [draft, setDraft] = useState<SimsMtsQuery>({ game, category: 38, sort: autoLoad ? 7 : 3, query: "", page: 1 }), [page, setPage] = useState<SimsMtsPage | null>(null), [busy, setBusy] = useState(false), [waiting, setWaiting] = useState(false), [canceling, setCanceling] = useState(false), [error, setError] = useState("");

  const task = useRef<{ id: string; canceled: boolean } | null>(null), alive = useRef(true), root = useRef<HTMLDivElement>(null), search = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);

  const focusCancel = useRef(false), focusSearch = useRef(false);

  const started = useRef<string | null>(null);

  const cancel = useCallback((navigation = false) => { const own = task.current; if (own) { if (navigation) started.current = null; own.canceled = true; void simsCancel(profile, own.id).catch(() => {}); } }, [profile]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [cancel]);

  useEffect(() => { if (!active) cancel(true); }, [active, cancel]);

  useEffect(() => { if (busy && focusCancel.current) { focusCancel.current = false; cancelButton.current?.focus({ preventScroll: true }); } else if (!busy && focusSearch.current) { focusSearch.current = false; (search.current ?? document.querySelector<HTMLInputElement>(".games-browser-mods .games-search input"))?.focus({ preventScroll: true }); } }, [busy]);

  const load = async (query: SimsMtsQuery, refresh = false) => {

    if (task.current || !active) return;

    const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;

    focusCancel.current = !!root.current?.contains(document.activeElement) || !!toolbarTarget?.contains(document.activeElement);

    setBusy(true); setWaiting(false); setCanceling(false); setError("");

    let stop: (() => void) | undefined;

    try {

      stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {

        if (payload.profile !== profile || payload.operationId !== own.id) return;

        if (payload.canCancel && (own.canceled || !alive.current)) void simsCancel(profile, own.id).catch(() => {});

        else if (alive.current) setWaiting(payload.phase === "waiting");

      });

      if (own.canceled || !alive.current) return;

      const value = await simsMtsBrowse(profile, query, own.id, refresh);

      if (alive.current && !own.canceled) {

        setPage(value); setDraft(value.query);

        if (page && page.query.page !== value.query.page) root.current?.scrollIntoView({ block: "start" });

      }

    } catch (reason) { if (alive.current && !own.canceled) setError(String(reason).includes("unknown field `game`") ? "games.sims.catalogUpdateRequired" : simsError(reason)); }

    finally {

      stop?.(); if (task.current === own) task.current = null;

      if (alive.current) { if (own.canceled && page) setDraft(page.query); focusSearch.current = document.activeElement === cancelButton.current; setBusy(false); }

    }

  };

  useEffect(() => {

    if (!autoLoad || !active || busy || started.current === query) return;

    const timer = setTimeout(() => { started.current = query; void load({ ...draft, query, page: 1 }); }, query ? 250 : 0);

    return () => clearTimeout(timer);

  }, [autoLoad, active, query, busy]);
  const sortOptions = [[7, "mtsPopular", "popular"], [3, "mtsUpdated", "updated"], [0, "mtsNewest", "newest"]] as const;
  const controls = <div className="sims-catalog-controls">
    <fieldset disabled={busy || !active}><Dropdown ariaLabel={label("mtsSort")} value={String(draft.sort)} options={sortOptions.map(([value, key, icon]) => ({ value: String(value), label: label(key), left: <SimsDiscoveryIcon kind={icon}/> }))} onChange={sort => { const next = { ...draft, sort: Number(sort), page: 1 }; setDraft(next); void load(next); }}/></fieldset>
    <fieldset disabled={busy || !active}><Dropdown ariaLabel={label("mtsCategory")} value={String(draft.category)} options={options.map(option => ({ ...option, left: <SimsDiscoveryIcon kind={categories.find(([id]) => String(id) === option.value)?.[1] ?? (option.value === "649" ? "Pets" : "sims")}/> }))} onChange={category => { const next = { ...draft, category: Number(category), page: 1 }; setDraft(next); void load(next); }}/></fieldset>
  </div>;
  return <div className={`games-sims-mts-browser${autoLoad ? ` is-discovery is-${view}` : ""}`} ref={root}>
    {autoLoad ? (toolbarTarget ? createPortal(controls, toolbarTarget) : controls) : <form onSubmit={event => { event.preventDefault(); void load({ ...draft, page: 1 }); }}>
      <fieldset disabled={busy || !active} className="games-sims-mts-filters">
        <label className="games-sims-mts-search"><span>{label("mtsSearch")}</span><span><Search size={16}/><input value={draft.query} maxLength={160} onChange={event => setDraft(value => ({ ...value, query: event.target.value }))}/></span></label>
        <div><small>{label("mtsCategory")}</small><Dropdown ariaLabel={label("mtsCategory")} value={String(draft.category)} options={options} onChange={category => setDraft(value => ({ ...value, category: Number(category), page: 1 }))}/></div>
        <div><small>{label("mtsSort")}</small><Dropdown ariaLabel={label("mtsSort")} value={String(draft.sort)} options={[{ value: "3", label: label("mtsUpdated") }, { value: "0", label: label("mtsNewest") }, { value: "7", label: label("mtsPopular") }]} onChange={sort => setDraft(value => ({ ...value, sort: Number(sort), page: 1 }))}/></div>
        <button ref={search} type="submit" className="games-button">{label("mtsBrowse")}</button>
      </fieldset>
    </form>}

    {busy && <div className={`games-sims-duplicates-progress${!page ? " is-initial-load" : ""}`}><p role="status"><LoaderCircle size={18}/>{t(waiting ? "games.sims.mtsWaiting" : "common.loading")}</p><button ref={cancelButton} className="games-button" aria-disabled={canceling} onClick={() => { if (!canceling) { cancel(); setCanceling(true); } }}>{t(canceling ? "games.download.state.canceling" : "common.cancel")}</button></div>}

    {error && <p role="alert">{t(error)}</p>}
    {autoLoad && !page && !busy && started.current !== null && <button ref={search} className="games-button" disabled={!active} onClick={() => void load({ ...draft, query, page: 1 }, true)}><RefreshCw size={18}/>{label("mtsRefresh")}</button>}

    {autoLoad && busy && !page && <SimsDiscoveryLoading/>}

    {page && <>

      <div className="games-sims-mts-results-head"><div>{autoLoad && <h3>{query ? label("mtsSearch") : label(sortOptions.find(([sort]) => sort === page.query.sort)?.[1] ?? "mtsPopular")}</h3>}<p role="status">{t("games.sims.mtsResults", { count: page.total?.toLocaleString(language) ?? page.projects.length, page: page.query.page })}</p></div><div className="mod-catalog-actions">{autoLoad && <ModViewToggle value={view} change={setView}/>}<button className="games-icon-button" disabled={busy || !active} aria-label={label("mtsRefresh")} onClick={() => void load(page.query, true)}><RefreshCw size={19}/></button></div></div>

      {page.stale && <p role="status">{label("mtsStale")}</p>}
      {!page.projects.length && <p>{label("mtsEmpty")}</p>}

      <div className="games-sims-mts-grid" aria-busy={busy}>{page.projects.map(project => autoLoad ? <SimsDiscoveryProject key={project.id} project={project} disabled={busy || !active} open={origin => select(project, origin)}/> : <button className="games-sims-mts-card" aria-label={project.title} key={project.id} disabled={busy || !active} onClick={event => select(project, event.currentTarget)}>
        <span className="mods-catalog-cover"><SimsMtsArt key={project.image} src={project.image} lazy skeleton={autoLoad}/> {project.picked && <span className="mod-card-pick">{t("games.modHub.picked")}</span>}</span><strong dir="auto">{project.title}</strong><small dir="auto">{project.creator}</small><span className="mods-card-description" dir="auto">{project.description}</span><span className="mods-card-footer"><ModStats values={project.metrics} compact/></span>

      </button>)}</div>

      <footer className="games-sims-mts-pagination"><button className="games-button" disabled={busy || !active || page.query.page <= 1} onClick={() => void load({ ...page.query, page: page.query.page - 1 })}><ArrowLeft size={16}/>{label("mtsPrevious")}</button><span>{t("games.sims.mtsPageNumber", { page: page.query.page })}</span><button className="games-button" disabled={busy || !active || !page.next} onClick={() => void load({ ...page.query, page: page.query.page + 1 })}>{label("mtsNext")}<ArrowRight size={16}/></button></footer>

      <div className="games-sims-mts-attribution"><small>{t("games.sims.mtsObserved", { date: new Date(page.observedAt * 1000).toLocaleString(language) })}</small><button className="games-detail-text-button" onClick={() => void openUrl(page.url)}><ModProviderLogo source="Mod The Sims"/><ArrowUpRight size={14}/></button></div>

    </>}

  </div>;

}

