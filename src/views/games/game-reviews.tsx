import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { INITIAL_REVIEW_FILTERS, type GameReviewFilters } from "@/lib/games/community";
import { GameMark } from "./game-ui";
import { SteamMark } from "./game-detail-marks";
import { ReviewCard, ReviewLoading, ReviewVerdictMark } from "./game-review-card";
import { useReviewPages } from "./use-review-pages";
import "./game-reviews.css";
import { ReviewFace } from "@/components/icons/review-face";

export function GameReviews({ appId, active }: { appId: number; active: boolean }) {
  return <Reviews key={appId} appId={appId} active={active}/>;
}

function Reviews({ appId, active }: { appId: number; active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), grid = useRef<HTMLDivElement>(null), focusPage = useRef(false);
  const [seen, setSeen] = useState(false), [filters, setFilters] = useState<GameReviewFilters>(INITIAL_REVIEW_FILTERS), [showFilters, setShowFilters] = useState(false);
  const { page, index, busy, failed, go, retry, visited } = useReviewPages(appId, filters, active && seen);
  useEffect(() => {
    if (!active || seen || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, seen]);
  useEffect(() => { if (page && focusPage.current) { focusPage.current = false; grid.current?.scrollIntoView({ block: "start" }); grid.current?.querySelector<HTMLAnchorElement>(".games-review-author")?.focus({ preventScroll: true }); } }, [page]);
  const change = (next: Partial<GameReviewFilters>) => { focusPage.current = false; setFilters(old => ({ ...old, ...next })); };
  const navigate = (next: number) => { if (next !== index) { focusPage.current = true; go(next); } };
  const percent = page?.summary?.total ? Math.round(page.summary.positive * 100 / page.summary.total) : null;
  const extraCount = Number(filters.language !== "english") + Number(filters.hours !== 0) + Number(filters.purchase !== "all") + Number(filters.deck);
  const community = `https://steamcommunity.com/app/${appId}/reviews/`;
  const available = Array.from({ length: visited }, (_, n) => n).filter(n => n === 0 || Math.abs(n - index) <= 2);
  return <section className="games-reviews games-inset" ref={root} aria-labelledby={`games-reviews-${appId}`}>
    <div className="games-community-heading"><div><p className="games-eyebrow">{t("games.community.players")}</p><h2 id={`games-reviews-${appId}`}>{t("games.community.reviews")}</h2></div><a className="games-community-link" href={community} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(community); }}><SteamMark/>{t("games.community.community")}<ArrowUpRight size={16}/></a></div>
    <div className="games-reviews-toolbar"><div className="games-review-summary">{percent !== null ? <><ReviewFace mood={percent>=90?"delighted":percent>=70?"positive":percent>=40?"mixed":percent>=20?"negative":"disappointed"} size={40} className="games-review-summary-face"/><strong>{percent}<small>%</small></strong><span>{t("games.community.recommend")}<small>{t("games.community.ratingCount", { count: page!.summary!.total.toLocaleString(language) })}</small></span></> : page?.total !== undefined ? <span>{t(page.total === 1 ? "games.community.oneMatch" : "games.community.matches", { count: page.total.toLocaleString(language) })}</span> : <span className="games-review-summary-placeholder games-review-skeleton" aria-hidden="true"/>}</div><div className="games-review-controls">
      <Dropdown ariaLabel={t("games.community.sort")} value={filters.sort} onChange={value => change({ sort: value as GameReviewFilters["sort"] })} options={["recent", "helpful", "updated"].map(value => ({ value, label: t(`games.community.sort.${value}`) }))}/>
      <Dropdown ariaLabel={t("games.community.sentiment")} value={filters.sentiment} onChange={value => change({ sentiment: value as GameReviewFilters["sentiment"] })} options={["all", "positive", "negative"].map(value => ({ value, label: t(`games.community.sentiment.${value}`), left: value === "all" ? <GameMark kind="filter" size={20}/> : <ReviewVerdictMark positive={value === "positive"} size={20}/> }))}/>
      <button className={`games-review-filter-toggle${extraCount ? " is-active" : ""}`} aria-expanded={showFilters} aria-controls={`games-review-filters-${appId}`} onClick={() => setShowFilters(value => !value)}><GameMark kind="filter" size={20}/>{t("games.community.filters")}{extraCount > 0 && <span>{extraCount}</span>}{showFilters ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
    </div></div>
    {showFilters && <div className="games-review-filters" id={`games-review-filters-${appId}`}>
      <label><span>{t("games.community.language")}</span><Dropdown ariaLabel={t("games.community.language")} value={filters.language} onChange={value => change({ language: value as GameReviewFilters["language"] })} options={["english", "all"].map(value => ({ value, label: t(`games.community.language.${value}`) }))}/></label>
      <label><span>{t("games.community.playtime")}</span><Dropdown ariaLabel={t("games.community.playtime")} value={String(filters.hours)} onChange={value => change({ hours: Number(value) as GameReviewFilters["hours"] })} options={[0, 10, 100].map(value => ({ value: String(value), label: t(value ? "games.community.minimumHours" : "games.community.anyPlaytime", { count: value }) }))}/></label>
      <label><span>{t("games.community.purchase")}</span><Dropdown ariaLabel={t("games.community.purchase")} value={filters.purchase} onChange={value => change({ purchase: value as GameReviewFilters["purchase"] })} options={["all", "steam", "other"].map(value => ({ value, label: t(`games.community.purchase.${value}`) }))}/></label>
      <button className="games-review-deck" aria-pressed={filters.deck} onClick={() => change({ deck: !filters.deck })}><span/>{t("games.community.deckOnly")}</button>
      {extraCount > 0 && <button className="games-review-reset" onClick={() => change({ language: "english", hours: 0, purchase: "all", deck: false })}>{t("games.community.resetFilters")}</button>}
    </div>}
    <p className="games-review-scope">{t(filters.language === "english" ? "games.community.englishScope" : "games.community.allScope")}{filters.hours ? ` · ${t("games.community.minimumHours", { count: filters.hours })}` : ""}{filters.deck ? ` · ${t("games.community.playedOnDeck")}` : ""}</p>
    <div ref={grid} className="games-review-results" aria-busy={busy}>
      {!page && !failed ? <ReviewLoading/> : page && <div className="games-reviews-grid" key={`${appId}:${JSON.stringify(filters)}:${index}`}>{page.reviews.map(review => <ReviewCard key={review.id} review={review} appId={appId}/>)}</div>}
      {page && !page.reviews.length && <p className="games-community-empty">{t("games.community.noReviews")}</p>}
      {failed && <div className="games-community-error" role="alert"><p>{t("games.community.reviewError")}</p><button className="games-button" onClick={retry}>{t("common.retry")}</button></div>}
    </div>
    <nav className="games-review-pagination" aria-label={t("games.community.reviewPages")}>
      <button className="games-button" disabled={index === 0 || busy} onClick={() => navigate(index - 1)}><ArrowLeft size={18}/>{t("games.community.previousPage")}</button>
      <div className="games-review-page-numbers">{available.map((number, n) => <span key={number}>{n > 0 && number > available[n - 1] + 1 && <i aria-hidden="true">…</i>}<button disabled={busy} aria-label={t("games.community.pageNumber", { count: number + 1 })} aria-current={number === index ? "page" : undefined} onClick={() => navigate(number)}>{(number + 1).toLocaleString(language)}</button></span>)}</div>
      <button className="games-button" disabled={!page?.cursor || busy} onClick={() => navigate(index + 1)}>{t("games.community.nextPage")}<ArrowRight size={18}/></button>
    </nav>
    <p className="games-review-page-status" role="status">{busy ? t("common.loading") : t("games.community.pageNumber", { count: index + 1 })}{page?.total !== undefined ? ` · ${t("games.community.matches", { count: page.total.toLocaleString(language) })}` : ""}</p>
    <p className="games-provenance">{t("games.community.reviewSource")}</p>
  </section>;
}
