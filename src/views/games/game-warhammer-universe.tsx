import { Play } from "@/components/icons/play-filled";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ArrowRight, Search } from "lucide-react";
import { Row } from "@/components/row";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadCurrentPlayerCounts, type GamePlayerCount } from "@/lib/games/player-counts";
import { loadWarhammerFeed, loadWarhammerVideos } from "@/lib/games/warhammer-universe";
import { WARHAMMER_SETTINGS, WARHAMMER_SECRET_LEVEL, WARHAMMER_ULTRAMARINES, WARHAMMER_SECRET_TRAILER, type WarhammerFeed, type WarhammerScreen, type WarhammerSetting } from "@/lib/games/warhammer-universe-data";
import type { GuideVideoPage } from "@/lib/games/guides-data";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { useHackVideo } from "./game-hack-video";
import { useLiveRefresh } from "./use-live-refresh";
import { WarhammerBrandMark, type WarhammerBrand } from "./game-warhammer-brand";
import "./game-warhammer-universe.css";

const key = (name: string) => `games.warhammerUniverse.${name}`;
function External({ url, children, className = "", brand }: { url: string; children: ReactNode; className?: string; brand?: WarhammerBrand }) {
  return <a className={className} href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(url); }}>{brand && <WarhammerBrandMark brand={brand}/>} {children}<ArrowUpRight size={15} aria-hidden/></a>;
}
function useNear(active: boolean) {
  const root = useRef<HTMLElement>(null), [near, setNear] = useState(false);
  useEffect(() => { if (!active || near || !root.current) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: "350px" }); observer.observe(root.current); return () => observer.disconnect(); }, [active, near]);
  return { root, ready: active && near };
}
function useFeed(kind: "animations" | WarhammerSetting, active: boolean) {
  const [state, setState] = useState<{ kind: string; data?: WarhammerFeed; failed: boolean; busy: boolean }>({ kind, failed: false, busy: true });
  const [attempt, setAttempt] = useState(0), revision = useLiveRefresh(active, 31 * 60_000);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController();
    setState(previous => ({ kind, data: previous.kind === kind ? previous.data : undefined, failed: false, busy: true }));
    void loadWarhammerFeed(kind, request.signal).then(data => { if (!request.signal.aborted) setState({ kind, data, failed: false, busy: false }); }, () => { if (!request.signal.aborted) setState(previous => ({ ...previous, failed: true, busy: false })); });
    return () => request.abort();
  }, [kind, active, attempt, revision]);
  return { data: state.kind === kind ? state.data : undefined, failed: state.kind === kind && state.failed, busy: state.kind !== kind || state.busy, retry: () => setAttempt(value => value + 1) };
}
function FeedStatus({ failed, retry }: { failed: boolean; retry: () => void }) {
  const t = useT();
  return failed ? <div className="wh-universe-status" role="alert"><span>{t(key("unavailable"))}</span><button className="games-button" onClick={retry}>{t("common.retry")}</button></div> : null;
}
function LoadingCards() {
  const t = useT();
  return <div className="wh-universe-loading" aria-busy="true" aria-label={t("common.loading")}>{[0, 1, 2].map(n => <div key={n} aria-hidden="true"><i className="games-detail-skeleton"/><b className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div>)}</div>;
}
function LoreLoading() {
  const t = useT();
  return <div className="wh-lore-layout" aria-busy="true" aria-label={t("common.loading")}><div className="wh-lore-grid wh-lore-skeleton" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span className="games-detail-skeleton" key={index}/>)}</div><div className="wh-lore-preview wh-lore-skeleton-preview" aria-hidden="true"><i className="games-detail-skeleton"/><div><b className="games-detail-skeleton"/><span className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div></div></div>;
}
function ScreenCard({ item }: { item: WarhammerScreen }) {
  const t = useT();
  return <article className="wh-screen-card"><External url={item.url} className="wh-screen-open"><span className="wh-screen-art"><GameArt src={item.image}/><span className="wh-screen-play"><Play size={24}/></span></span><strong dir="auto">{item.title}</strong></External><span>{item.free ? t(key("free")) : t(key("subscription"))}{item.minutes ? ` · ${item.minutes} min` : ""}</span><p dir="auto">{item.summary}</p></article>;
}

export function WarhammerStory({ active, game, open, openMedia }: { active: boolean; game?: GameSummary; open: (game: GameSummary) => void; openMedia?: (target: GameMediaTarget) => void }) {
  const t = useT(), language = useUiLanguage(), watch = useHackVideo(), [observation, setObservation] = useState<GamePlayerCount>();
  const revision = useLiveRefresh(active, 125_000);
  useEffect(() => { if (!active) return; const request = new AbortController(); setObservation(undefined); void loadCurrentPlayerCounts([2183900], request.signal).then(rows => { if (!request.signal.aborted) setObservation(rows[0]); }).catch(() => {}); return () => request.abort(); }, [active, revision]);
  const media = () => openMedia ? openMedia(WARHAMMER_SECRET_LEVEL) : void openUrl("https://www.imdb.com/title/tt33204697/");
  return <section id="wh-story" className="wh-story" aria-labelledby="wh-story-title">
    <div className="wh-story-panel"><GameArt className="wh-story-art" src="https://i.ytimg.com/vi/YMZffM5bKmg/maxresdefault.jpg"/>
      <div className="wh-story-copy"><span className="wh-section-kicker">Secret Level · Warhammer 40,000</span><h2 id="wh-story-title" tabIndex={-1}>{t(key("storyTitle"))}</h2><p>{t(key("storyNote"))}</p><div className="wh-story-actions"><button className="wh-action is-primary" onClick={media}><Play size={20}/>{t(key("openSeries"))}</button><button className="wh-action is-secondary" onClick={() => watch(WARHAMMER_SECRET_TRAILER)}>{t(key("trailer"))}<ArrowUpRight size={20}/></button></div></div>
      <button className="wh-story-scene" onClick={() => watch(WARHAMMER_SECRET_TRAILER)} aria-label={t(key("trailer"))}><span className="wh-scene-play"><Play size={28}/></span><span className="wh-scene-caption"><strong>And They Shall Know No Fear</strong><small>{t(key("episode"))}</small></span></button>
    </div>
    <div className="wh-story-footer">{game && <button className="wh-game-connection" onClick={() => open(game)}><GameArt src={game.capsule}/><span><strong>{game.name}</strong>{observation && <small>{t(key("playing"), { count: observation.currentPlayers.toLocaleString(language) })}</small>}</span><ArrowRight size={20}/></button>}<External url="https://www.warhammer-community.com/en-gb/articles/2iuskcvl/secret-level-warhammer-animation-news-out-of-new-york-comic-con/">{t(key("connection"))}</External></div>
  </section>;
}

export function WarhammerScreenLibrary({ active, openMedia }: { active: boolean; openMedia?: (target: GameMediaTarget) => void }) {
  const t = useT(), { root, ready } = useNear(active), feed = useFeed("animations", ready);
  const openMovie = () => openMedia ? openMedia(WARHAMMER_ULTRAMARINES) : void openUrl("https://www.imdb.com/title/tt1679332/");
  return <section className="wh-universe-section" id="wh-screen" ref={root} aria-labelledby="wh-screen-title"><div className="wh-section-heading"><div><h2 id="wh-screen-title" tabIndex={-1}>{t(key("screen"))}</h2><p>{t(key("screenNote"))}</p></div><External url="https://warhammertv.com/" brand="tv">Warhammer TV</External></div>
    <FeedStatus failed={feed.failed} retry={feed.retry}/>{!feed.data && !feed.failed ? <LoadingCards/> : <Row min={295} shape="landscape" scrollKey="warhammer-screen" arrowsAlways alwaysActive={active}>
      {(feed.data?.items ?? []).map(item => <ScreenCard key={item.id} item={item}/>)}
      <article className="wh-screen-card"><button className="wh-screen-open" onClick={openMovie}><span className="wh-screen-art"><GameArt src="https://images.metahub.space/background/medium/tt1679332/img" fallback={WARHAMMER_ULTRAMARINES.poster}/><span className="wh-screen-play"><Play size={24}/></span></span><strong>Ultramarines</strong></button><span>{t("games.media.movie")} · 2010</span><p>{t(key("movieNote"))}</p></article>
    </Row>}
    {feed.data?.partial && <p className="wh-source-note" role="status">{t(key("partial"))}</p>}
    <p className="wh-source-note">{t(key("screenScope"))}</p>
  </section>;
}

export function WarhammerLoreLibrary({ active }: { active: boolean }) {
  const t = useT(), { root, ready } = useNear(active), [setting, setSetting] = useState<WarhammerSetting>("40k"), [query, setQuery] = useState(""), [selected, setSelected] = useState<string>();
  const list = useRef<HTMLDivElement>(null), preview = useRef<HTMLElement>(null), previewId = useId();
  const feed = useFeed(setting, ready);
  const filtered = (feed.data?.items ?? []).filter(item => `${item.title} ${item.keywords} ${item.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const current = filtered.find(item => item.id === selected) ?? filtered[0];
  const world = WARHAMMER_SETTINGS.find(item => item.id === setting)!;
  const pickSetting = (value: WarhammerSetting) => { setSetting(value); setQuery(""); setSelected(undefined); };
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [setting, query]);
  const select = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      const panel = preview.current, bounds = panel?.getBoundingClientRect();
      if (panel && bounds && (bounds.top < 88 || bounds.top > window.innerHeight - 180)) panel.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  };
  return <section className="wh-universe-section" id="wh-lore" ref={root} aria-labelledby="wh-lore-title"><div className="wh-section-heading"><div><h2 id="wh-lore-title" tabIndex={-1}>{t(key("lore"))}</h2><p>{t(key("loreNote"))}</p></div><span className="wh-section-kicker">Loremasters · Warhammer TV</span></div>
    <div className="wh-lore-tools"><div className="wh-setting-tabs" aria-label={t(key("setting"))}>{WARHAMMER_SETTINGS.map(item => <button key={item.id} aria-pressed={setting === item.id} onClick={() => pickSetting(item.id)}>{item.name}</button>)}</div><label className="games-search"><Search size={17}/><input aria-label={t(key("searchLore"))} placeholder={t(key("searchLore"))} value={query} onChange={event => setQuery(event.target.value)}/></label></div>
    <FeedStatus failed={feed.failed} retry={feed.retry}/>
    {!feed.data && !feed.failed ? <LoreLoading/> : current ? <div className="wh-lore-layout"><div className="wh-lore-index"><span className="wh-source-note" role="status">{t(key("subjects"), { count: filtered.length })}</span><div ref={list} className="wh-lore-grid" role="group" aria-label={t(key("lore"))} onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      buttons[next]?.focus({ preventScroll: true }); buttons[next]?.scrollIntoView({ block: "nearest" });
    }}>{filtered.map(item => <button key={item.id} tabIndex={item.id === current.id ? 0 : -1} aria-controls={previewId} aria-pressed={item.id === current.id} onClick={() => select(item.id)}><GameArt src={item.image}/><strong dir="auto">{item.title}</strong></button>)}</div></div><article ref={preview} id={previewId} className="wh-lore-preview" aria-label={current.title}><GameArt src={current.image}/><div><span className="wh-section-kicker">{world.name}{current.minutes ? ` · ${current.minutes} min` : ""}</span><h3 dir="auto">{current.title}</h3><p dir="auto">{current.summary}</p><External className="games-button" url={current.url} brand="tv"><span>{t(key("watchLore"))}</span></External><small>{current.free ? t(key("free")) : t(key("subscription"))}</small></div></article></div> : feed.data && <p className="wh-universe-status" role="status">{t("games.noResults")}</p>}
    {feed.data?.partial && <p className="wh-source-note" role="status">{t(key("partial"))}</p>}
    <div className="wh-lore-footer"><span className="wh-source-note">{t(key("loreScope"))}</span><External url="https://warhammertv.com/series/25010" brand="tv">{t(key("fullLibrary"))}</External></div>
    <div className="wh-reading"><External url={world.guide} brand={setting}><span>{setting === "40k" ? t(key("settingGuide")) : world.name}</span></External><External url="https://www.blacklibrary.com/" brand="black-library"><span>Black Library · {t(key("books"))}</span></External><External url={setting === "40k" || setting === "heresy" ? "https://wh40k.lexicanum.com/wiki/Main_Page" : "https://lexicanum.com/"} brand="lexicanum"><span>Lexicanum · {t(key("encyclopedia"))}</span></External></div>
  </section>;
}

export function WarhammerCreatorVideos({ active }: { active: boolean }) {
  const t = useT(), watch = useHackVideo(), { root, ready } = useNear(active), [query, setQuery] = useState(""), [search, setSearch] = useState(""), [page, setPage] = useState<GuideVideoPage>(), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null), loadedQuery = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ready) { setBusy(false); return; }
    // A media detail page temporarily deactivates the atlas. Keep its loaded row
    // and continuation so Back restores the same results and scroll position.
    if (loadedQuery.current === search) return () => controller.current?.abort();
    const request = new AbortController(); controller.current = request; loadedQuery.current = undefined; setFailed(false); setBusy(true); setPage(undefined);
    void loadWarhammerVideos(search, request.signal).then(value => { if (!request.signal.aborted) { loadedQuery.current = search; setPage(value); setBusy(false); } }, () => { if (!request.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => { request.abort(); controller.current?.abort(); };
  }, [ready, search, attempt]);
  const more = async () => {
    if (!page?.cursor || busy || !ready) return;
    const request = new AbortController(); controller.current = request; setBusy(true); setFailed(false);
    try { const next = await loadWarhammerVideos(search, request.signal, page.cursor); if (!request.signal.aborted) setPage(previous => ({ ...next, items: [...new Map([...(previous?.items ?? []), ...next.items].map(item => [item.id, item])).values()] })); }
    catch { if (!request.signal.aborted) setFailed(true); }
    finally { if (!request.signal.aborted) setBusy(false); }
  };
  return <section id="wh-videos" className="wh-universe-section" ref={root} aria-labelledby="wh-videos-title"><div className="wh-section-heading"><div><h2 id="wh-videos-title" tabIndex={-1}>{t(key("videos"))}</h2><p>{t(key("videosNote"))}</p></div></div>
    <div className="wh-community-links"><External url="https://www.warhammer-community.com/en-gb/setting/warhammer-40000/" brand="community"><span><strong>Warhammer Community</strong><small>{t(key("news"))}</small></span></External><External url="https://community.focus-entmt.com/focus-entertainment/space-marine-2" brand="focus"><span><strong>Focus Together</strong><small>{t(key("discussions"))}</small></span></External><External url="https://wh40k.lexicanum.com/wiki/Main_Page" brand="lexicanum"><span><strong>Lexicanum</strong><small>{t(key("encyclopedia"))}</small></span></External></div>
    <form className="games-search wh-video-search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); }}><Search size={19}/><input aria-label={t(key("searchVideos"))} placeholder={t(key("searchVideos"))} value={query} onChange={event => setQuery(event.target.value)}/><button type="submit">{t("common.search")}</button></form>
    <FeedStatus failed={failed} retry={() => page ? void more() : setAttempt(value => value + 1)}/>{!page && !failed ? <LoadingCards/> : <Row min={295} shape="landscape" scrollKey={`warhammer-videos-${search}`} arrowsAlways alwaysActive={active}>{(page?.items ?? []).map(item => <button className="wh-video-card" key={item.id} onClick={() => watch({ id: item.id, title: item.title, creator: item.author, gameName: "Warhammer", gameId: 0 })}><span><GameArt src={item.image}/><span className="wh-video-play"><Play size={23}/></span>{item.duration && <small>{item.duration}</small>}</span><strong dir="auto">{item.title}</strong><span>{item.author}{item.published ? ` · ${item.published}` : ""}</span></button>)}</Row>}
    {page && !page.items.length && <p className="wh-universe-status" role="status">{t("games.noResults")}</p>}
    <div className="wh-lore-footer"><External url={`https://www.youtube.com/results?search_query=${encodeURIComponent(`Warhammer ${search || "40k lore explained"}`)}`}>{t("games.hub.onYouTube")}</External>{page?.cursor && <button className="games-button" disabled={busy} onClick={() => void more()}>{t(busy ? "common.loading" : "games.guides.more")}</button>}</div>
  </section>;
}
