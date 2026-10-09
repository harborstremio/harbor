import { useEffect, useRef } from "react";
import { Row } from "@/components/row";
import { Play } from "@/components/icons/play-filled";
import { useInViewport } from "@/lib/visibility";
import { useT } from "@/lib/i18n";
import { queryIgdb } from "@/lib/games/atlas";
import { hackVideoQuery, hackVideoPage } from "@/lib/games/hack-videos";
import { GameArt } from "./game-art";
import { useHackVideo } from "./game-hack-video";
import { usePagedGameRow } from "./use-paged-game-row";

function Continuation({ active, cursor, busy, more }: { active: boolean; cursor: number; busy: boolean; more: () => void }) {
  const root = useRef<HTMLDivElement>(null), visible = useInViewport(root);
  useEffect(() => { if (active && visible && !busy) more(); }, [active, visible, cursor, busy, more]);
  return <div ref={root} className="games-hack-video-placeholder" aria-hidden="true"><div className="games-skeleton"/><div className="games-skeleton"/></div>;
}
export function GameHackVideoRow({ active, baseId }: { active: boolean; baseId?: number }) {
  const t = useT(), watch = useHackVideo(), root = useRef<HTMLElement>(null), visible = useInViewport(root);
  const row = usePagedGameRow({ id: `hack-videos:${baseId ?? "all"}`, active: active && visible, load: async (offset, signal) => hackVideoPage(await queryIgdb(hackVideoQuery(offset, baseId), signal), offset, baseId) });
  const more = () => { if (!row.busy && !row.failed && row.loaded && row.nextOffset !== null) void row.more(row.games.length + 8); };
  return <section className="games-hack-videos" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.hub.watchTitle")}</h2><p>{t("games.hub.watchNote")}</p></div></div>
    <Row className="games-hack-video-rail" min={220} shape="landscape" arrowsAlways scrollKey={`hack-videos:${baseId ?? "all"}`} onEndReached={more}>
      {row.games.map(video => <button className="games-hack-video-card" key={video.id} onClick={() => watch(video)}><span className="games-hack-video-art"><GameArt src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}/><span><Play size={20}/></span></span><strong>{video.gameName}</strong><span className="games-hack-video-caption">{video.title}</span>{video.creator && <small>{video.creator}</small>}</button>)}
      {!row.loaded && !row.failed && [0,1,2,3].map(i => <div className="games-hack-video-placeholder" key={i} aria-hidden="true"><div className="games-skeleton"/><div className="games-skeleton"/></div>)}
      {row.loaded && row.nextOffset !== null && !row.failed && <Continuation active={active && visible} cursor={row.nextOffset} busy={row.busy} more={more}/>}
    </Row>
    {row.failed && <div className="games-inline-status" role="alert"><span>{t("games.hub.videoUnavailable")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    {row.loaded && !row.busy && !row.failed && !row.games.length && <p className="games-source-explainer">{t("games.hub.noVideos")}</p>}
  </section>;
}
