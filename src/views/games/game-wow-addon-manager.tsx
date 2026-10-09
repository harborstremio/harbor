import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { loadWowAddonCatalog, loadWowAddonCategories } from "@/lib/games/wow-addon-catalog";
import { selectWowAddonCatalog, type WowAddonCategories, type WowAddonList } from "@/lib/games/wow-addon-catalog-data";
import { loadWowAddonWorkspace, wowAddonError, type WowAddonWorkspace, type WowAddonRequest } from "@/lib/games/wow-addon-manager";
import type { WowAddonInventory } from "@/lib/games/wow-addon-data";
import { GameArt } from "./game-art";
import { GameWowAddonReview } from "./game-wow-addon-review";
import "./game-wow-addon-manager.css";

type Selection = { title: string; addonId?: number; request: WowAddonRequest | { action: "recover" } };
export function GameWowAddonManager({ id, profile, active, inventory, changed }: { id: string; profile: string; active: boolean; inventory: WowAddonInventory | null; changed: () => void }) {
  const t = useT(), language = useUiLanguage(), heading = useId(), opener = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const [open, setOpen] = useState(false), [mode, setMode] = useState("browse"), [query, setQuery] = useState(""), [category, setCategory] = useState("all"), [sort, setSort] = useState<"popular" | "updated" | "name">("popular"), [page, setPage] = useState(0);
  const [catalog, setCatalog] = useState<WowAddonList | null>(null), [categories, setCategories] = useState<WowAddonCategories | null>(null), [catalogError, setCatalogError] = useState(false), [categoryError, setCategoryError] = useState(false), [retry, setRetry] = useState(0);
  const [workspace, setWorkspace] = useState<WowAddonWorkspace | null>(null), [workspaceError, setWorkspaceError] = useState(""), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(false), [selected, setSelected] = useState<Selection | null>(null);
  const close = () => { returnFocus.current = true; setOpen(false); setSelected(null); };
  useSectionBack(close, open && active && !selected);
  useEffect(() => {
    if (open || !returnFocus.current) return;
    if (!active) { returnFocus.current = false; return; }
    // Restore only after the browser's controls and shell Back have settled.
    const frame = requestAnimationFrame(() => { returnFocus.current = false; opener.current?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [open, active]);
  useEffect(() => { if (!active) { setOpen(false); setSelected(null); } }, [active]);
  useEffect(() => {
    if (!open || !active) return;
    let current = true; setLoading(true); setWorkspaceError("");
    void loadWowAddonWorkspace(id).then(value => { if (current) { setWorkspace(value); setLoading(false); } }, reason => { if (current) { setWorkspace(null); setWorkspaceError(wowAddonError(reason)); setLoading(false); } });
    return () => { current = false; };
  }, [open, active, id, profile, refresh]);
  useEffect(() => {
    if (!open || !active || mode !== "browse") return;
    const controller = new AbortController(); setCatalogError(false); setCategoryError(false);
    void loadWowAddonCatalog(controller.signal).then(value => { if (!controller.signal.aborted) setCatalog(value.data); }, () => { if (!controller.signal.aborted) setCatalogError(true); });
    void loadWowAddonCategories(controller.signal).then(value => { if (!controller.signal.aborted) setCategories(value.data); }, () => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [open, active, mode, retry]);
  const result = useMemo(() => selectWowAddonCatalog(catalog?.addons ?? [], categories?.categories ?? [], query, category === "all" ? null : Number(category), sort, page), [catalog, categories, query, category, sort, page]);
  const byCategory = useMemo(() => new Map(categories?.categories.map(item => [item.id, item])), [categories]);
  const available = !loading && !workspaceError && workspace?.id === id;
  const imports = useMemo(() => {
    const candidates = new Map<number, { id: number; title: string; version: string }>();
    if (inventory?.id === id) for (const addon of inventory.addons) {
      const manifest = addon.manifest, key = manifest?.wowiId;
      if (addon.state === "ready" && manifest && key && !workspace?.addons.some(item => item.id === key) && !candidates.has(key)) candidates.set(key, { id: key, title: manifest.title || addon.folder, version: manifest.version });
    }
    return [...candidates.values()];
  }, [id, inventory, workspace]);
  const applied = (value: WowAddonWorkspace) => { setWorkspace(value); setWorkspaceError(""); changed(); };
  return <div className="wow-addon-manager">
    <button ref={opener} className="games-button" aria-expanded={open} aria-controls={heading} onClick={() => open ? close() : setOpen(true)}><Search size={16}/>{t("games.wow.manager.browse")}</button>
    {open && active && <section id={heading} className="wow-addon-browser" aria-label={t("games.wow.manager.browse")}>
      <header><div className="wow-addon-tabs">{["browse", "managed", "backups"].map(value => <button key={value} className="games-button" aria-pressed={mode === value} onClick={() => setMode(value)}>{t(`games.wow.manager.${value}`)}</button>)}</div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={18}/></button></header>
      {workspaceError && <p className="wow-addon-notice" role="status">{t(workspaceError)} <button className="games-button" onClick={() => setRefresh(value => value + 1)}>{t("common.retry")}</button></p>}
      {workspace?.recoveryPending && <p className="wow-addon-notice" role="status">{t("games.wow.manager.recovery")} <button className="games-button" disabled={!available} onClick={() => setSelected({ title: t("games.wow.manager.recover"), request: { action: "recover" } })}>{t("games.wow.manager.recover")}</button></p>}
      {mode === "browse" ? <>
        <p className="wow-addon-caption">{t("games.wow.manager.catalogNote")}</p>
        <div className="wow-addon-search"><label data-tv-focus-container><Search size={17}/><input type="search" aria-label={t("games.wow.addons.search")} placeholder={t("games.wow.addons.search")} value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label><Dropdown value={category} ariaLabel={t("games.wow.manager.category")} options={[{ value: "all", label: t("games.wow.manager.allCategories") }, ...(categories?.categories ?? []).map(item => ({ value: String(item.id), label: item.title }))]} onChange={value => { setCategory(value); setPage(0); }}/><Dropdown value={sort} ariaLabel={t("games.wow.manager.sort")} options={["popular", "updated", "name"].map(value => ({ value, label: t(`games.wow.manager.${value}`) }))} onChange={value => { setSort(value as typeof sort); setPage(0); }}/></div>
        {(catalogError || categoryError) && <p className="wow-addon-notice" role="status">{t(catalogError ? "games.wow.manager.catalogError" : "games.wow.manager.categoriesError")} <button className="games-button" onClick={() => setRetry(value => value + 1)}>{t("common.retry")}</button></p>}
        {(catalog?.partial || categories?.partial) && <p className="wow-addon-caption">{t("games.wow.manager.partial")}</p>}
        {!catalog && !catalogError ? <div className="wow-addon-catalog" aria-busy="true" aria-label={t("common.loading")}>{[0,1,2,3,4,5].map(value => <i key={value} className="games-detail-skeleton"/>)}</div> : <>
          <div className="wow-addon-catalog">{result.addons.map(addon => { const group = byCategory.get(addon.categoryId ?? -1); return <button key={addon.id} className="wow-addon-catalog-item" onClick={() => setSelected({ title: addon.title, addonId: addon.id, request: { action: "install", addonId: addon.id } })}>
            {group?.icon && <GameArt src={group.icon} className="wow-addon-category-art"/>}<div><strong dir="auto">{addon.title}</strong><small dir="auto">{addon.author}{group && ` · ${group.title}`}</small><span>{addon.version || "—"}{addon.monthlyDownloads !== null && <span title={t("games.wow.manager.monthly")}><Download size={12}/>{Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(addon.monthlyDownloads)}</span>}</span></div><ChevronRight size={16}/>
          </button>; })}</div>
          {!result.total && <p className="wow-addon-caption">{t("games.wow.addons.noMatches")}</p>}
          <div className="wow-addon-pagination"><span>{result.total.toLocaleString(language)} · WoWInterface</span><div><button className="games-icon-button" disabled={!result.page} aria-label={t("common.previous")} onClick={() => setPage(result.page - 1)}><ChevronLeft size={18}/></button><span>{result.page + 1} / {Math.max(1, Math.ceil(result.total / 24))}</span><button className="games-icon-button" disabled={!result.hasNext} aria-label={t("common.next")} onClick={() => setPage(result.page + 1)}><ChevronRight size={18}/></button></div></div>
        </>}
      </> : <>
        <p className="wow-addon-caption">{t("games.wow.manager.managedNote")}</p>
        <button className="games-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16}/>{t("games.wow.addons.refresh")}</button>
        {loading && <p role="status">{t("common.loading")}</p>}
        {mode === "managed" ? <div className="wow-addon-managed">{workspace?.addons.map(addon => <article key={addon.id}><div><strong>{addon.title}</strong><small>{addon.version} · {addon.folders.join(", ")}</small></div><div><button className="games-button" disabled={!available || workspace?.recoveryPending} onClick={() => setSelected({ title: addon.title, addonId: addon.id, request: { action: "install", addonId: addon.id } })}>{t("games.mods.reviewChanges")}</button><button className="games-button" disabled={!available || workspace?.recoveryPending} onClick={() => setSelected({ title: addon.title, addonId: addon.id, request: { action: "remove", addonId: addon.id } })}>{t("common.remove")}</button></div></article>)}{available && workspace?.addons.length === 0 && <p className="wow-addon-caption">{t("games.wow.manager.emptyManaged")}</p>}</div> : <div className="wow-addon-managed">{workspace?.backups.map(backup => <article key={backup.token}><div><strong>{backup.addon.title}</strong><small>{backup.addon.version} · {new Date(backup.createdAt).toLocaleString(language)}</small></div><button className="games-button" disabled={!available || workspace?.recoveryPending} onClick={() => setSelected({ title: backup.addon.title, addonId: backup.addon.id, request: { action: "restore", backup: backup.token } })}>{t("games.mods.restore")}</button></article>)}{available && workspace?.backups.length === 0 && <p className="wow-addon-caption">{t("games.wow.manager.emptyBackups")}</p>}</div>}
      </>}
      {mode === "managed" && imports.length > 0 && <section className="wow-addon-imports"><h3>{t("games.wow.manager.importInstalled")}</h3><p className="wow-addon-caption">{t("games.wow.manager.importScope")}</p>{available && !workspace?.canAdopt && <p className="wow-addon-notice">{t("games.wow.manager.errorDesktop")}</p>}<div className="wow-addon-managed">{imports.map(addon => <article key={addon.id}><div><strong>{addon.title}</strong><small>{addon.version} · WoWInterface</small></div><button className="games-button" disabled={!available || !workspace?.canAdopt || workspace?.recoveryPending} onClick={() => setSelected({ title: addon.title, addonId: addon.id, request: { action: "adopt", addonId: addon.id } })}>{t("games.wow.manager.import")}</button></article>)}</div></section>}
      <a className="wow-addon-source" href="https://www.wowinterface.com/addons.php" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl("https://www.wowinterface.com/addons.php"); }}>WoWInterface<ArrowUpRight size={14}/></a>
    </section>}
    {selected && active && open && <GameWowAddonReview key={`${profile}:${id}:${selected.request.action}:${selected.addonId ?? "recovery"}`} id={id} profile={profile} title={selected.title} addonId={selected.addonId} request={selected.request} available={!!available && (selected.request.action !== "adopt" || !!workspace?.canAdopt) && (!workspace?.recoveryPending || selected.request.action === "recover")} unavailable={workspaceError || (workspace?.recoveryPending ? "games.wow.manager.recovery" : selected.request.action === "adopt" && !workspace?.canAdopt ? "games.wow.manager.errorDesktop" : "common.loading")} onClose={() => { setSelected(null); setRefresh(value => value + 1); }} changed={applied}/>}
  </div>;
}
