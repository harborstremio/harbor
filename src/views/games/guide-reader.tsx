import { GameNotesButton } from "./game-notes-launcher";
import { useOptionalGameAccess } from "./game-access";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Wrench, Monitor, Mouse, Volume2, Wifi, HardDrive, Info, ShoppingBag, Cpu, ShieldCheck, Gamepad2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { openUrl } from "@/lib/window";
import type { GameGuide,GuideArticle,GuideSection } from "@/lib/games/guides-data";
import { loadGuideArticle } from "@/lib/games/guides-fetch";
import { GuideSourceRateLimit } from "@/lib/games/guide-source-status";
import { outlineGuide } from "@/lib/games/guide-outline";
import { GuideContents, useGuidePosition } from "./guide-contents";
import { GuideRetry } from "./guide-retry";
import { SteamMark } from "./game-detail-marks";
import { GameArt } from "./game-art";
import type { GuideGame } from "./game-guides";
import { GuideProviderMark,GuideSourceLink,guideSourceName } from "./guide-shared";
import "./steam-guide.css";
import { GuideMarkup } from "./guide-markup";
import { pokemonGuideLink } from "@/lib/games/pokemon-guides";
import { GuideExportActions } from "./guide-export-actions";
import "./guide-export.css";

function sectionIcon(title:string) {
  return /video|display|resolution/i.test(title)?Monitor:/input|control/i.test(title)?Mouse:/audio|sound/i.test(title)?Volume2:/network|multiplayer/i.test(title)?Wifi:/game data|save|config/i.test(title)?HardDrive:/availability|monetization/i.test(title)?ShoppingBag:/requirement/i.test(title)?Cpu:/issues|fix/i.test(title)?Wrench:/vr|controller/i.test(title)?Gamepad2:/anti.cheat|security/i.test(title)?ShieldCheck:Info;
}
export function GuideReader({game,item,active,back,follow}:{game:GuideGame;item:GameGuide;active:boolean;back?:()=>void;follow?:(item:GameGuide)=>void}) {
  const access=useOptionalGameAccess();
  const t=useT(),reduced=useReducedMotion(),[article,setArticle]=useState<GuideArticle|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const root=useRef<HTMLElement>(null),video=item.source==="youtube"||item.source==="kick",[retryAt,setRetryAt]=useState(0);
  useEffect(()=>{if(!active||video)return;const request=new AbortController();setFailed(false);setRetryAt(0);setArticle(null);void loadGuideArticle(item,game.steamId,request.signal).then(value=>{if(!request.signal.aborted)setArticle(value);},error=>{if(!request.signal.aborted){setFailed(true);if(error instanceof GuideSourceRateLimit)setRetryAt(error.retryAt);}});return()=>request.abort();},[active,item.id,attempt]);
  const outline=useMemo(()=>article?outlineGuide(article):{sections:[],headings:[],entries:[]},[article]);
  const {current,jump}=useGuidePosition(root,outline.entries,active,reduced);
  const cover=item.source==="pcwiki"?"":article?.image||item.image;
  return <article className={`games-guide-reader ${item.source==="pcwiki"?"games-guide-technical":item.source==="steam"?"games-guide-steam":""}`} ref={root}>
    <header className="games-guides-hero games-guide-reader-hero"><GameArt className="games-guides-backdrop" src={cover||game.hero||game.capsule} fallback={game.hero||game.capsule} eager/>
      <div className="games-guide-reader-heading games-inset">
        {back&&<button className="games-detail-back" onClick={back}><ArrowLeft size={16}/>{t("common.back")}</button>}
        <p className="games-guides-game-name">{game.name}</p>
        <div className={`games-guide-heading-layout ${cover?"has-cover":""}`}>
          {cover&&<div className="games-guide-cover"><GameArt src={cover} fallback={item.image} eager/></div>}
          <div className="games-guide-heading-copy">
            <div className="games-guide-byline">{item.source==="steam"?<SteamMark/>:item.source==="pcwiki"?<Wrench size={20}/>:item.source==="bulbapedia"?<BookOpen size={20}/>:<GuideProviderMark provider={item.source}/>}<span>{guideSourceName(item)}</span></div>
            <h1 tabIndex={-1}>{article?.title||item.title}</h1>
            {(article?.authors?.length||item.author&&item.author!==guideSourceName(item))&&<div className="games-guide-authors">
              {article?.authors?.length?article.authors.map(author=>author.url?<GuideSourceLink key={author.url} href={author.url}>{author.avatar&&<GameArt src={author.avatar}/>}<span>{author.name}</span></GuideSourceLink>:<span key={author.name}>{author.name}</span>):<span>{item.author}</span>}
            </div>}
            <div className="games-guide-reader-actions">{access&&article&&item.source==="steam"&&<GameNotesButton profile={access.profile} gameId={game.libraryEntryId??game.id} name={game.name} active={active} guide={{item,article}}/>}<GuideSourceLink href={item.url}>{t("games.guides.original")}</GuideSourceLink>{!video&&article&&<GuideExportActions value={{game:game.name,item,article}} active={active}/>}</div>
          </div>
        </div>
      </div>
    </header>
    {video?<div className="games-inset games-guide-video"><div className="games-guide-player">{active&&<iframe src={item.source==="kick"?`https://player.kick.com/${encodeURIComponent(item.id)}?autoplay=false`:`https://www.youtube-nocookie.com/embed/${item.id}?autoplay=0&rel=0&playsinline=1`} title={item.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}</div><p>{t("games.guides.embedNote")}</p></div>:failed?<div className="games-inset"><div className="games-guide-unavailable" role="alert"><div className="games-guide-unavailable-art"><GameArt src={item.image} fallback={game.capsule}/><BookOpen size={32}/></div><div><span>{guideSourceName(item)}</span><h2>{t("games.guides.readerErrorTitle")}</h2><p>{t("games.guides.readerError")}</p><div className="games-guide-unavailable-actions"><GuideRetry retryAt={retryAt} onRetry={()=>setAttempt(n=>n+1)}/><GuideSourceLink href={item.url}>{t("games.guides.original")}</GuideSourceLink></div></div></div></div>:!article?<ReaderSkeleton/>:<div className="games-inset games-guide-reading-layout games-guide-content-enter"><GuideContents headings={outline.headings} current={current} jump={jump} iconForSection={item.source==="pcwiki"?sectionIcon:undefined}/><GuideProse sections={outline.sections} item={item} follow={follow}/></div>}
  </article>;
}
function ReaderSkeleton(){const t=useT();return <div className="games-inset games-guide-reading-layout games-guide-reader-skeleton" role="status" aria-label={t("common.loading")}><aside aria-hidden><h2/><nav>{Array.from({length:7},(_,i)=><span key={i}/>)}</nav></aside><div className="games-guide-prose" aria-hidden>{[0,1].map(i=><section key={i}><h2/><div className="games-guide-skeleton-table">{[0,1,2,3].map(n=><span key={n}/>)}</div></section>)}</div></div>;}

const GuideProse=memo(function GuideProse({sections,item,follow}:{sections:GuideSection[];item:GameGuide;follow?:(item:GameGuide)=>void}){const t=useT();return <div className="games-guide-prose" onClick={event=>{const link=(event.target as Element).closest<HTMLAnchorElement>("a[href]");if(link){event.preventDefault();const next=pokemonGuideLink(item,link.href);if(next&&follow)follow(next);else void openUrl(link.href);}}}>{sections.map(section=>{const Icon=item.source==="pcwiki"?sectionIcon(section.title):null;return <section key={section.id}><h2 id={section.id} tabIndex={-1}>{Icon&&<Icon size={24}/>} {section.title}</h2><GuideMarkup html={section.html}/></section>;})}{item.source==="bulbapedia"&&<footer><GuideSourceLink href={item.url}>Bulbapedia</GuideSourceLink><GuideSourceLink href={`${item.url}?action=history`}>{t("games.guides.credits")}</GuideSourceLink><GuideSourceLink href="https://creativecommons.org/licenses/by-nc-sa/2.5/">CC BY-NC-SA 2.5</GuideSourceLink></footer>}{item.source==="pcwiki"&&<footer><GuideSourceLink href={item.url}>PCGamingWiki</GuideSourceLink><GuideSourceLink href={`${item.url}?action=history`}>{t("games.guides.credits")}</GuideSourceLink><GuideSourceLink href="https://creativecommons.org/licenses/by-nc-sa/3.0/">CC BY-NC-SA 3.0</GuideSourceLink></footer>}</div>;});
