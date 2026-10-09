import { ModBackToTop } from "./mod-back-to-top";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { ModStats, type ModMetrics } from "./mod-stats";
import { openUrl } from "@/lib/window";
import type { ModGameId } from "@/lib/games/mod-workspace";
import { ModGameMark, ModProviderLogo } from "./mod-identity";
import "./mod-project-page.css";

/** A project owns this screen; browsing chrome stays on the catalog behind it. */
export function ModProjectPage({ title, creator, description, game, source, sourceUrl, category, metrics, media, actions, children }: {
  title: string; creator?: string; description?: string; game: ModGameId; source: string; sourceUrl?: string; category?: string;
  metrics?: ModMetrics | null; media: ReactNode; actions: ReactNode; children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null), root = useRef<HTMLElement>(null);
  useLayoutEffect(() => { root.current?.scrollIntoView({ block: "start" }); heading.current?.focus({ preventScroll: true }); }, []);
  return <article ref={root} className="mod-project-page">
    <header className="mod-project-heading">
      <div className="mod-project-context"><ModGameMark game={game}/>{sourceUrl ? <button className="mod-project-source" onClick={() => void openUrl(sourceUrl)}><ModProviderLogo source={source}/><ArrowUpRight size={13}/></button> : <ModProviderLogo source={source}/>}{category && <span className="mod-category-badge" dir="auto">{category}</span>}</div>
      <h2 ref={heading} tabIndex={-1} dir="auto">{title}</h2>
      {creator && <p className="mod-project-author" dir="auto">{creator}</p>}
      {description && <p className="mod-project-summary" dir="auto">{description}</p>}
      <ModStats values={metrics}/>
    </header>
    <div className="mod-project-layout"><div className="mod-project-main">{media}{children}</div><aside className="mod-project-sidebar">{actions}</aside></div>
    <ModBackToTop/>
  </article>;
}
