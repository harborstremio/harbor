import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Clock3, MessageSquare, UserRound } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { gameReviewUrl, type GameReview, type GameReviewAuthor } from "@/lib/games/community";
import { loadReviewAuthor } from "@/lib/games/community-fetch";
import { ReviewFace } from "@/components/icons/review-face";

/** Individual Steam recommendations are binary; never infer an intensity from the review text. */
export function ReviewVerdictMark({ positive, size = 24 }: { positive: boolean; size?: number }) {
  return <ReviewFace mood={positive?"positive":"negative"} size={size}/>;
}

function Reviewer({ review }: { review: GameReview }) {
  const t = useT(), language = useUiLanguage();
  const [author, setAuthor] = useState<GameReviewAuthor | null>(null), [pending, setPending] = useState(true), [broken, setBroken] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    setAuthor(null); setPending(true); setBroken(false);
    void loadReviewAuthor(review.author, request.signal).then(value => { if (!request.signal.aborted) setAuthor(value); }, () => {}).finally(() => { if (!request.signal.aborted) setPending(false); });
    return () => request.abort();
  }, [review.author]);
  const url = `https://steamcommunity.com/profiles/${review.author}/`;
  return <a className="games-review-author" href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(url); }}>
    <span className={`games-review-avatar${pending ? " is-loading" : ""}`} aria-hidden="true">{author?.avatar && !broken ? <img src={author.avatar} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)}/> : <UserRound size={25}/>}</span>
    <span><strong dir="auto" className={pending ? "is-loading" : undefined}>{author?.name || t("games.community.reviewer")}</strong><small>{review.reviewCount !== undefined ? t(review.reviewCount === 1 ? "games.community.authorOneReview" : "games.community.authorReviews", { count: review.reviewCount.toLocaleString(language) }) : "Steam"}</small></span>
  </a>;
}

export function ReviewCard({ review, appId }: { review: GameReview; appId: number }) {
  const t = useT(), language = useUiLanguage(), [expanded, setExpanded] = useState(false), [response, setResponse] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null), [clipped, setClipped] = useState(false);
  useEffect(() => { const node = paragraph.current; if (!node || expanded) return; const measure = () => setClipped(node.scrollHeight > node.clientHeight + 1); measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect(); }, [expanded, review.body]);
  const hours = (minutes: number) => (minutes / 60).toLocaleString(language, { maximumFractionDigits: 1 });
  const url = gameReviewUrl(review, appId);
  return <article className="games-review-card" data-review={review.id}>
    <img className="games-review-watermark" src="/games/brands/steam.svg" alt="" aria-hidden="true"/>
    <div className="games-review-identity"><Reviewer review={review}/><time dateTime={new Date(review.date * 1000).toISOString()}>{new Date(review.date * 1000).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" })}</time></div>
    <div className="games-review-heading"><span className={`games-review-vote${review.positive ? " is-positive" : ""}`}><ReviewVerdictMark positive={review.positive}/>{t(review.positive ? "games.community.positive" : "games.community.negative")}</span></div>
    <div className="games-review-meta">{review.totalMinutes !== undefined && <span className="games-review-total-hours"><Clock3 size={16}/>{t("games.community.totalHours", { count: hours(review.totalMinutes) })}</span>}{review.minutes !== undefined && <span>{t("games.community.hoursAtReview", { count: hours(review.minutes) })}</span>}{review.deck && <span>{t("games.community.playedOnDeck")}</span>}</div>
    <p ref={paragraph} className={`games-review-text${expanded ? " is-expanded" : ""}`}>{review.body}</p>
    {(expanded || clipped) && <button className="games-review-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? "games.community.less" : "games.community.readMore")}{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>}
    {(review.free || review.earlyAccess || review.refunded) && <div className="games-review-disclosures">{review.free && <span>{t("games.community.receivedFree")}</span>}{review.earlyAccess && <span>{t("games.community.earlyAccess")}</span>}{review.refunded && <span>{t("games.community.refunded")}</span>}</div>}
    {review.response && <div className="games-review-response"><button onClick={() => setResponse(value => !value)} aria-expanded={response}><MessageSquare size={16}/>{t("games.community.developerResponse")}{response ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>{response && <p>{review.response}</p>}</div>}
    <div className="games-review-footer"><span>{review.helpful ? t("games.community.helpfulCount", { count: review.helpful.toLocaleString(language) }) : t(review.purchased ? "games.community.steamPurchase" : "games.community.otherPurchase")}</span><a href={url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(url); }}>{t("games.community.original")}<ArrowUpRight size={15}/></a></div>
  </article>;
}

export function ReviewLoading() {
  const t = useT();
  return <div className="games-reviews-grid games-review-placeholders" aria-label={t("common.loading")} aria-busy="true">{Array.from({ length: 6 }, (_, index) => <article className="games-review-card" key={index} aria-hidden="true"><div className="games-review-identity"><span className="games-review-avatar games-review-skeleton"/><div className="games-review-loading-name"><i className="games-review-skeleton"/><i className="games-review-skeleton"/></div></div><i className="games-review-loading-vote games-review-skeleton"/><i className="games-review-loading-meta games-review-skeleton"/><div className="games-review-loading-copy">{[0,1,2].map(n => <i key={n} className="games-review-skeleton"/>)}</div><div className="games-review-footer"><i className="games-review-skeleton"/><i className="games-review-skeleton"/></div></article>)}</div>;
}
