import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Trophy } from "lucide-react";

import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { GameNews } from "@/lib/games/community";
import { loadGameNews } from "@/lib/games/community-fetch";
import { selectNewsArtwork } from "@/lib/games/news-art";
import { GameArt } from "./game-art";
export { GameReviews } from "./game-reviews";
import { SteamMark } from "./game-detail-marks";
import "./game-community.css";

function External({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(href); }}>{children}</a>;
}
function useNearGameSection(active: boolean) {
  const root = useRef<HTMLElement>(null), [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!active || seen || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, seen]);
  return { root, ready: active && seen };
}
function DateLabel({ date }: { date: number }) {
  return <time dateTime={new Date(date * 1000).toISOString()}>{new Date(date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>;
}
function NewsImage({ source, onError }: { source: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return <img src={source} alt="" loading="lazy" decoding="async" data-loaded={loaded} onLoad={() => setLoaded(true)} onError={onError} />;
}

export function GameUpdates({ appId, active, screenshots, excludedArtwork, pageSize = 2 }: { appId: number; active: boolean; screenshots: readonly string[]; excludedArtwork?: readonly string[]; pageSize?: number }) {
  const t = useT(), { root, ready } = useNearGameSection(active);
  const [items, setItems] = useState<GameNews[] | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [page, setPage] = useState(0);
  const pages = Math.ceil((items?.length ?? 0) / pageSize);
  const artwork = useMemo(() => selectNewsArtwork(items ?? [], screenshots, excludedArtwork), [items, screenshots, excludedArtwork]);
  const [unavailableImages, setUnavailableImages] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!ready) return;
    const request = new AbortController(); setFailed(false);
    void loadGameNews(appId, request.signal).then(data => { if (!request.signal.aborted) setItems(data); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [appId, ready, attempt]);
  return <section className="games-updates games-inset" ref={root} aria-labelledby={`games-updates-${appId}`}>
    <div className="games-community-heading"><h2 id={`games-updates-${appId}`}>{t("games.community.studio")}</h2><External className="games-community-link" href={`https://store.steampowered.com/news/app/${appId}`}><SteamMark />{t("games.community.allUpdates")}</External></div>
    {failed ? <div className="games-community-error" role="alert"><p>{t("games.community.newsError")}</p><button className="games-button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></div>
      : !items ? <div className="games-news-grid" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: pageSize }, (_, index) => <article key={index} className="games-news-card games-news-placeholder" aria-hidden="true"><div className="games-news-image games-detail-skeleton"/><div className="games-news-copy"><i className="games-detail-skeleton"/><b className="games-detail-skeleton"/><span className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div></article>)}</div> : !items.length ? <p className="games-community-empty">{t("games.community.noUpdates")}</p>
      : <><div className="games-news-grid" aria-live="polite">{items.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => {
        const art = artwork[page * pageSize + index];
        const image = [art?.primary, art?.backup].find(source => source && !unavailableImages.has(source));
        return <article className="games-news-card" key={item.id} data-artwork={!!image}>
        <External className="games-news-open" href={item.url}>
          {image && <div className="games-news-image"><NewsImage key={image} source={image} onError={() => setUnavailableImages(previous => new Set(previous).add(image))} /></div>}
          <div className="games-news-copy"><DateLabel date={item.date} /><h3>{item.title}</h3><p>{item.body}</p></div>
        </External>
      </article>; })}</div>{pages > 1 && <nav className="games-news-pagination" aria-label={t("games.community.allUpdates")}>{Array.from({length: pages}, (_, index) => <button key={index} aria-label={t("games.player.position", {current:index + 1,total:pages})} aria-current={index === page ? "page" : undefined} onClick={() => setPage(index)}>{index + 1}</button>)}</nav>}</>}
  </section>;
}

export function GameAchievementHighlights({ appId, total, items }: { appId: number; total: number; items: { name: string; icon: string }[] }) {
  const t = useT(), [shown, setShown] = useState(false);
  return <section className="games-achievement-highlights"><div><Trophy size={18} /><h3>{t("games.achievements")}</h3><span>{total.toLocaleString()}</span></div><p>{t("games.community.achievementsNote")}</p><button className="games-achievement-reveal" aria-expanded={shown} onClick={() => setShown(value => !value)}>{t(shown ? "games.community.hideAchievements" : "games.community.showAchievements")}{shown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{shown && <><ul>{items.map(item => <li key={item.name}><GameArt src={item.icon} /><span>{item.name}</span></li>)}</ul><External className="games-community-link" href={`https://steamcommunity.com/stats/${appId}/achievements/`}>{t("games.community.allAchievements")}<ArrowUpRight size={14} /></External></>}</section>;
}
