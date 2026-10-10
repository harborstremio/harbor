import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, RefreshCw, Search, Star, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import type { DeadlockHero } from "@/lib/games/deadlock-data";
import { DEADLOCK_BUILD_PAGE, deadlockBuildGroupKey, deadlockBuildLanguage, type DeadlockBuild, type DeadlockBuildSort } from "@/lib/games/deadlock-builds-data";
import { loadDeadlockBuildDefinitions, loadDeadlockBuilds } from "@/lib/games/deadlock-builds";
import { GameArt } from "./game-art";
import "./game-deadlock-builds.css";

const k = (key: string) => `games.deadlockBuilds.${key}`;
type Page = Awaited<ReturnType<typeof loadDeadlockBuilds>>;
type Definitions = Awaited<ReturnType<typeof loadDeadlockBuildDefinitions>>;

export function GameDeadlockBuilds({ hero, active, onOpen }: { hero: DeadlockHero; active: boolean; onOpen: () => void }) {
  const t = useT(), trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false);
  const dismiss = useCallback(() => { setOpen(false); requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); }); }, []);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  return <><button className="games-button games-deadlock-builds-open" ref={trigger} onClick={() => { onOpen(); setOpen(true); }}><BookOpen size={17}/>{t(k("open"))}</button>{open && active && <BuildBrowser hero={hero} onClose={dismiss}/>}</>;
}

function BuildBrowser({ hero, onClose }: { hero: DeadlockHero; onClose: () => void }) {
  const t = useT(), language = useUiLanguage(), title = useId(), { closing, close } = useModalExit(onClose);
  const root = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null), body = useRef<HTMLDivElement>(null);
  const returnBuild = useRef<number | null>(null), returnScroll = useRef(0), restore = useRef(false);
  const [selected, setSelected] = useState<DeadlockBuild | null>(null), [draft, setDraft] = useState("");
  const [query, setQuery] = useState(""), [sort, setSort] = useState<DeadlockBuildSort>("updated_at"), [buildLanguage, setBuildLanguage] = useState(deadlockBuildLanguage(language));
  const [offset, setOffset] = useState(0), [attempt, setAttempt] = useState(0);
  const queryKey = JSON.stringify([hero.id, sort, query, buildLanguage, offset]);
  const [result, setResult] = useState<{ key: string; page: Page | null; busy: boolean; failed: boolean }>({ key: "", page: null, busy: true, failed: false });
  const page = result.key === queryKey ? result.page : null, busy = result.key !== queryKey || result.busy;
  const failed = result.key === queryKey && result.failed;
  const refresh = useRef(false), focusResults = useRef(false);
  useEffect(() => {
    if (closing) return;
    const controller = new AbortController(), force = refresh.current; refresh.current = false;
    setResult(previous => ({ key: queryKey, page: previous.key === queryKey ? previous.page : null, busy: true, failed: false }));
    void loadDeadlockBuilds(hero.id, sort, query, buildLanguage, offset, controller.signal, force).then(value => {
      if (!controller.signal.aborted) setResult({ key: queryKey, page: value, busy: false, failed: false });
    }, () => { if (!controller.signal.aborted) setResult(previous => ({ ...previous, busy: false, failed: true })); });
    return () => controller.abort();
  }, [hero.id, queryKey, attempt, closing]);
  useEffect(() => {
    if (busy || !focusResults.current) return; focusResults.current = false;
    body.current?.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>('[data-build-id]')
        ?? root.current?.querySelector<HTMLElement>('.games-deadlock-builds-status button,[data-build-results]');
      target?.focus({ preventScroll: true });
    });
  }, [busy, page, failed]);
  const back = useCallback(() => { if (selected) { setSelected(null); restore.current = true; } else close(); }, [selected, close]);
  useSectionBack(back, true);
  useEffect(() => {
    if (selected || !restore.current) return; restore.current = false;
    const frame = requestAnimationFrame(() => { if (body.current) body.current.scrollTop = returnScroll.current; root.current?.querySelector<HTMLButtonElement>(`[data-build-id="${returnBuild.current}"]`)?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || document.querySelector('[data-dropdown-menu]')) return;
      const controls = [...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],summary') ?? []].filter(node => node.getClientRects().length);
      if (event.shiftKey && (document.activeElement === controls[0] || !root.current?.contains(document.activeElement))) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !root.current?.contains(document.activeElement))) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", trap); return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap); };
  }, []);
  const retry = () => { refresh.current = true; setAttempt(value => value + 1); };
  const changePage = (value: number) => { focusResults.current = true; setOffset(value); };
  return <ModalShell closing={closing} onDismiss={back} width={920} labelledBy={title} backdropClassName="games-deadlock-builds-backdrop bg-black/50">
    <div className="games-deadlock-builds-modal" ref={root} data-tv-focus-scope>
      <header>{selected ? <button className="games-icon-button" onClick={back} aria-label={t(k("back"))} data-tv-modal-close><ArrowLeft size={20}/></button> : <GameArt src={hero.image} eager/>}<div><span>{hero.name}</span><h2 id={title} dir="auto">{selected?.name ?? t(k("open"))}</h2></div><button ref={closeButton} className="games-icon-button" onClick={close} aria-label={t("common.close")} data-tv-modal-close={selected ? undefined : true}><X size={20}/></button></header>
      <div className="games-deadlock-builds-scroll" ref={body}>
        {selected ? <BuildGuide key={`${selected.id}:${selected.version}:${language}`} build={selected} language={language} closing={closing}/> : <>
          <p className="games-deadlock-builds-note">{t(k("intro"))}</p>
          <div className="games-deadlock-builds-tools"><form onSubmit={event => { event.preventDefault(); setQuery(draft.trim()); setOffset(0); }}><Search size={16}/><input type="search" value={draft} onChange={event => setDraft(event.target.value)} maxLength={100} aria-label={t(k("search"))} placeholder={t(k("search"))}/><button className="games-icon-button" type="submit" aria-label={t(k("search"))}><ArrowRight size={17}/></button></form>
            <Dropdown ariaLabel={t("games.companion.sort")} value={sort} onChange={value => { setSort(value as DeadlockBuildSort); setOffset(0); }} options={[{ value: "updated_at", label: t(k("recent")) }, { value: "weekly_favorites", label: t(k("popular")) }]}/>
            <Dropdown ariaLabel={t(k("language"))} value={buildLanguage} onChange={value => { setBuildLanguage(value); setOffset(0); }} options={[{ value: deadlockBuildLanguage(language), label: new Intl.DisplayNames([language], { type: "language" }).of(deadlockBuildLanguage(language)) ?? "English" }, { value: "all", label: t(k("allLanguages")) }]}/>
            <button className="games-icon-button" onClick={retry} disabled={busy} aria-label={t(k("refresh"))}><RefreshCw size={17}/></button>
          </div>
          {failed && <div className="games-deadlock-builds-status" role="status"><span>{t(k("failed"))}</span><button className="games-button" onClick={retry} disabled={busy}>{t("common.retry")}</button></div>}
          {busy && !page ? <div className="games-deadlock-builds-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 4 }, (_, index) => <i key={index} className="games-detail-skeleton"/>)}</div> : page && <div data-build-results tabIndex={-1}>
            <div className="games-deadlock-build-list">{page.data.builds.map(build => <button key={build.id} data-build-id={build.id} onClick={() => { returnBuild.current = build.id; returnScroll.current = body.current?.scrollTop ?? 0; setSelected(build); body.current?.scrollTo({ top: 0, behavior: "instant" }); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('header > button')?.focus({ preventScroll: true })); }}><strong dir="auto">{build.name}</strong><span>{build.updated ? t(k("updated"), { date: new Date(build.updated).toLocaleDateString(language) }) : t(k("undated"))}{build.weekly !== null && <small><Star size={13}/>{t(k("favorites"), { count: build.weekly.toLocaleString(language) })}</small>}</span></button>)}</div>
            {!page.data.builds.length && <p className="games-deadlock-builds-status">{t(k("empty"))}</p>}
            <div className="games-deadlock-builds-pages"><button className="games-button" disabled={!offset || busy} onClick={() => changePage(Math.max(0, offset - DEADLOCK_BUILD_PAGE))}><ArrowLeft size={16}/>{t("common.previous")}</button><span>{t(k("page"), { page: String(offset / DEADLOCK_BUILD_PAGE + 1) })}</span><button className="games-button" disabled={!page.data.more || busy || offset >= 10_000} onClick={() => changePage(offset + DEADLOCK_BUILD_PAGE)}>{t("common.next")}<ArrowRight size={16}/></button></div>
            <p className="games-deadlock-builds-note">Deadlock API · {t(k("checked"), { date: new Date(page.at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</p>
          </div>}
        </>}
      </div>
    </div>
  </ModalShell>;
}

function BuildGuide({ build, language, closing }: { build: DeadlockBuild; language: string; closing: boolean }) {
  const t = useT(), [definitions, setDefinitions] = useState<Definitions | null>(null), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), force = useRef(false);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (closing) return;
    const controller = new AbortController(), refresh = force.current; force.current = false; setBusy(true);
    void loadDeadlockBuildDefinitions(build.hero, language, controller.signal, refresh).then(value => { if (!controller.signal.aborted) { setDefinitions(value); setBusy(false); } }, () => { if (!controller.signal.aborted) { setDefinitions({ items: [], abilities: [], partial: true }); setBusy(false); } });
    return () => controller.abort();
  }, [build.hero, language, attempt, closing]);
  const items = new Map(definitions?.items.map(item => [item.id, item])), abilities = new Map(definitions?.abilities.map(item => [item.id, item]));
  const missing = !!definitions && (definitions.partial || build.groups.some(group => group.items.some(item => !items.has(item.id) || item.imbue && !abilities.has(item.imbue))));
  return <div className="games-deadlock-build-guide">
    <div className="games-deadlock-build-meta"><span>{t(k("version"), { version: String(build.version) })}</span><span>{build.updated ? t(k("updated"), { date: new Date(build.updated).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) }) : t(k("undated"))}</span><button className="games-button" onClick={() => void navigator.clipboard.writeText(String(build.id)).then(() => setCopy("done"), () => setCopy("failed"))}>{copy === "done" ? <Check size={16}/> : <Copy size={16}/>} {t(k(copy === "done" ? "copied" : "copy"))}</button></div>
    <p className="games-deadlock-builds-note">{t(k("use"))} <code>{build.id}</code></p>
    {copy === "failed" && <p role="status" className="games-deadlock-builds-note">{t(k("copyFailed"))}</p>}
    {build.note && <p className="games-deadlock-build-author-note" dir="auto">{build.note}</p>}
    <p className="games-deadlock-builds-note">{t(k("definitions"))}</p>
    {missing && <div className="games-deadlock-builds-status" role="status"><span>{t(k("itemsFailed"))}</span><button className="games-button" disabled={busy} onClick={() => { force.current = true; setAttempt(value => value + 1); }}>{t("common.retry")}</button></div>}
    {busy && !definitions && <div className="games-deadlock-builds-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/></div>}
    {!build.groups.length && <p className="games-deadlock-builds-note">{t(k("noItems"))}</p>}
    {build.groups.map((group, index) => <section key={index} className="games-deadlock-build-group"><div><h3 dir="auto">{deadlockBuildGroupKey(group.name) ? t(k(deadlockBuildGroupKey(group.name)!), { number: String(index + 1) }) : group.name || t(k("group"), { number: String(index + 1) })}</h3>{group.optional && <span>{t(k("optional"))}</span>}</div>{group.note && <p className="games-deadlock-build-author-note" dir="auto">{group.note}</p>}<ol>{group.items.map((entry, position) => {
      const item = items.get(entry.id), imbue = entry.imbue ? abilities.get(entry.imbue) : undefined;
      return <li key={`${position}:${entry.id}`}><GameArt src={item?.image ?? ""}/><div><strong dir="auto">{item?.name ?? t(k("item"), { id: String(entry.id) })}</strong>{item && <span>{item.shopable ? item.cost !== null ? t(k("cost"), { cost: item.cost.toLocaleString(language) }) : t(k("costUnknown")) : t(k("notInShop"))}</span>}{entry.imbue && <span>{t(k("imbue"), { ability: imbue?.name ?? `#${entry.imbue}` })}</span>}{entry.flex !== null && entry.flex > 0 && <span>{t(k("flex"), { count: String(entry.flex) })}</span>}{entry.note && <p dir="auto">{entry.note}</p>}</div></li>;
    })}</ol></section>)}
  </div>;
}
