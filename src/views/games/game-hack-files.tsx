import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadAtlasGame } from "@/lib/games/atlas";
import { hackRelease, type HackRelease } from "@/lib/games/hack-catalog";
import { loadHackFiles } from "@/lib/games/hack-files-fetch";
import type { GameSource, SourceFile, SourceRelease } from "@/lib/games/sources";
import type { GameSummary } from "@/lib/games/types";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import { useSourceTransfers } from "./game-source-links";
import { SourceReleaseRow } from "./game-sources";
import "./game-hack-files.css";

export function GameHackFiles({ game, active = true, downloads, compact = false, acquire, disabled = false }: { game: GameSummary & {projectUrl?: string;parent?:GameSummary}; active?: boolean; downloads?: GameTransfers; compact?: boolean; acquire?: (url:string) => void; disabled?: boolean }) {
  const inheritedDownloads = useSourceTransfers();
  downloads ??= inheritedDownloads;
  const t = useT(), knownRelease = hackRelease(game), [attempt,setAttempt] = useState(0);
  const [state,setState] = useState<{key:string;busy:boolean;failed:boolean;files:SourceFile[];version:string;release?:HackRelease}>();
  const key = `${game.id}:${knownRelease?.page ?? ""}`;
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); setState({key,busy:true,failed:false,files:[],version:"",release:knownRelease});
    void (async () => {
      const detail = !knownRelease && game.igdbId ? await loadAtlasGame(game, request.signal) : null;
      const resolved = detail ?? game, release = hackRelease(resolved);
      if (!request.signal.aborted) setState({key,busy:true,failed:false,files:[],version:"",release});
      const result = await loadHackFiles(resolved,request.signal);
      if (!request.signal.aborted) setState({key,busy:false,failed:false,...result,release});
    })().catch(() => { if (!request.signal.aborted) setState(previous => ({key,busy:false,failed:true,files:[],version:"",release:previous?.release ?? knownRelease})); });
    return () => request.abort();
  },[key,active,attempt]);
  const current = state?.key === key ? state : undefined, release = current?.release ?? knownRelease;
  const entry: SourceRelease = useMemo(() => ({ id:key,title:game.name,igdbId:game.igdbId,sourcePage:release?.page,kind:release?.method === "modpack" ? "mod" : "patch",version:current?.version,files:current?.files ?? [] }),[key,game.name,game.igdbId,release?.page,release?.method,current]);
  const source: GameSource = { id:`hack-project:${game.id}`,url:release?.page ?? "",name:release ? new URL(release.page).hostname : "",homepage:release?.page,format:"website",enabled:true,entries:[entry],skipped:0,checkedAt:Date.now() };
  return <section className={`games-hack-files${compact ? " is-compact" : " games-inset"}`}>
    {!compact && <div className="games-section-heading"><div><span className="games-section-kicker">{t("games.hub.communityMade")}</span><h2>{t("games.hub.filesTitle")}</h2></div>{release && <a className="games-text-action" href={release.page} onClick={e=>{e.preventDefault();void openUrl(release.page);}}>{t("games.hub.project")}</a>}</div>}
    {!compact && <p>{t(release?.method === "modpack" ? "games.hub.packNote" : "games.hub.downloadNote")}</p>}
    {(release?.base || game.parent) && !compact && <p className="games-hack-required">{t("games.patch.gameFile")}: <strong>{release?.base ?? game.parent?.name}</strong></p>}
    {(!current || current.busy) && <div className="games-hack-files-loading" aria-busy="true" aria-label={t("games.hub.gettingFiles")}>{[0,1].map(i=><div className="games-skeleton" key={i}/>)}</div>}
    {!!current?.files.length && current.files.map(file => acquire && file.kind === "direct" && (/\.(bps|ips|ups)$/i.test(file.name) || /\.(bps|ips|ups)(?:[?#]|$)/i.test(file.url)) ? <button key={file.url} className="games-hack-patch-download" disabled={disabled} onClick={()=>acquire(file.url)}><Download size={20}/><span><strong>{file.name}</strong><small>{t("games.hub.downloadApply")}</small></span></button> : downloads ? <SourceReleaseRow key={file.url} source={source} release={{...entry,id:`${key}:${file.url}`,files:[file]}} game={{id:game.id,name:game.name,artwork:game.portrait ?? game.capsule,sourceName:source.name}} downloads={downloads} presentation="dialog" showCompatibility={false}/> : <div className="games-hack-file-links" key={file.url}><a href={file.url} onClick={e=>{e.preventDefault();void openUrl(file.url);}}><span><strong>{file.name}</strong><small>{new URL(file.url).hostname}</small></span><Download size={19}/></a></div>)}
    {compact && release && <a className="games-text-action games-hack-project-link" href={release.page} onClick={e=>{e.preventDefault();void openUrl(release.page);}}>{t("games.hub.project")}</a>}
    {current?.failed && <div className="games-inline-status" role="alert"><span>{t("games.hub.downloadFailed")}</span><button className="games-button" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>}
    {(current && !current.busy && !current.failed && !current.files.length) && <p>{t("games.hub.noDownload")}</p>}
  </section>;
}
