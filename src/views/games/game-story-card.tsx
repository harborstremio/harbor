import { useEffect, useRef, useState, type CSSProperties } from "react";
import { observeWithin } from "@/lib/visibility";
import { ArrowUpRight, BookOpen, Film, Tv } from "lucide-react";
import { ScoreStack } from "@/components/card-score-stack";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { loadGameBookCover } from "@/lib/games/cross-media-fetch";
import { gameMediaPoster, gameMediaRelationKey, gameMediaTarget, gameMediaUrl, type GameMedia, type GameMediaTarget } from "@/lib/games/cross-media";
import { useBpCardBadges } from "@/views/big-picture/use-bp-card-badges";

function StoryScores({ item }: { item: GameMedia }) {
  const { settings } = useSettings();
  const target = gameMediaTarget(item)!;
  // Use the existing movie/TV provider chain and card preferences, including limits/placement.
  const { badges } = useBpCardBadges({ id: item.imdbId ?? target.id, name: item.name, type: item.kind === "series" ? "series" : "movie" }, undefined, item.imdbId, "card");
  return <span className="games-media-scores"><ScoreStack badges={badges} limit={settings.cardBadgeLimit} placement={settings.badgePlacement} /></span>;
}

function StoryArtwork({ item, active, seen }: { item: GameMedia; active: boolean; seen: boolean }) {
  const book = item.kind === "book" && item.openLibraryId ? item.openLibraryId : undefined;
  const [cover, setCover] = useState<{ src: string; pending: boolean }>({ src: gameMediaPoster(item), pending: !!book });
  const [loaded, setLoaded] = useState(""), [failed, setFailed] = useState("");
  useEffect(() => {
    if (!book || !active || !seen) return;
    const request = new AbortController();
    void loadGameBookCover(book, request.signal).then(src => {
      if (!request.signal.aborted) setCover({ src, pending: false });
    }, () => { if (!request.signal.aborted) setCover({ src: "", pending: false }); });
    return () => request.abort();
  }, [book, active, seen]);
  const src = cover.src, ready = !!src && loaded === src, broken = !!src && failed === src;
  const loading = active && seen && (cover.pending || (!!src && !ready && !broken));
  useEffect(() => {
    if (!active || !seen || !src || ready || broken) return;
    const timer = window.setTimeout(() => setFailed(src), 12_000);
    return () => window.clearTimeout(timer);
  }, [active, seen, src, ready, broken]);
  const Icon = item.kind === "book" ? BookOpen : item.kind === "series" ? Tv : Film;
  return <>
    <span className="games-media-art-fallback" aria-hidden="true"><Icon size={30} strokeWidth={1.5}/></span>
    {loading && <span className="games-media-art-skeleton" aria-hidden="true"/>}
    {seen && src && !broken && <img className="games-media-image" src={src} alt="" decoding="async" data-loaded={ready} onLoad={() => setLoaded(src)} onError={() => setFailed(src)}/>}
  </>;
}

export function GameStoryCard({ item, index, active, open, evidence }: { item: GameMedia; index: number; active: boolean; open?: (target: GameMediaTarget) => void; evidence?:{url:string;label:string} }) {
  const t = useT(), root = useRef<HTMLElement>(null), [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    return observeWithin(node, "200px", entry => { if (entry.isIntersecting) setSeen(true); });
  }, []);
  const target = gameMediaTarget(item), internal = !!(target && open);
  const Icon = item.kind === "book" ? BookOpen : item.kind === "series" ? Tv : Film;
  const relationship = evidence?.label ?? t(gameMediaRelationKey(item), { name: item.via?.name ?? "" });
  const activate = () => { if (target && open) open(target); else openUrl(gameMediaUrl(item)); };
  return <article ref={root} className="games-media-card" data-media-id={item.qid} style={{ "--story-delay": `${Math.min(index, 5) * 28}ms` } as CSSProperties}>
    <button className="games-media-open" onClick={activate} aria-label={t(internal ? "games.media.open" : "games.media.external", { name: item.name })}>
      <div className="games-media-art">
        <StoryArtwork item={item} active={active} seen={seen}/>
        {item.kind !== "book" && target && active && seen && <StoryScores item={item}/>}
      </div>
      <div className="games-media-caption">
        <h3 title={item.name}>{item.name}</h3>
        <span className="games-media-meta"><span className="games-media-kind"><Icon size={12} strokeWidth={1.7}/>{t(`games.media.${item.kind}`)}</span>{item.year && <><span aria-hidden="true">·</span><time>{item.year}</time></>}{!internal && <ArrowUpRight size={12} className="games-media-external"/>}</span>
      </div>
    </button>
    <a className="games-media-relation" href={evidence?.url??`https://www.wikidata.org/wiki/${item.qid}`} target="_blank" rel="noreferrer" title={`${relationship} · ${t("games.media.evidence")}`} onClick={event => { event.preventDefault(); openUrl(event.currentTarget.href); }}><span>{relationship}</span><ArrowUpRight size={11}/></a>
  </article>;
}
