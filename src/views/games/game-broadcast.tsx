import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Radio, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadGameBroadcasts } from "@/lib/games/detail-extras";
import type { GameBroadcast } from "@/lib/games/detail-extras-data";
import { GameBroadcastPlayer } from "./game-broadcast-player";
import { observe, usePageVisible } from "@/lib/visibility";
import "./game-broadcast.css";

export function GameLiveBroadcast({ appId, active }: { appId: number; active: boolean }) {
  const t = useT(), [items, setItems] = useState<GameBroadcast[]>([]), [expanded, setExpanded] = useState(false), [revision, setRevision] = useState(0), [selected, setSelected] = useState<string>(), [watching, setWatching] = useState(false);
  const root = useRef<HTMLElement>(null), [revealed, setRevealed] = useState(false), [visible, setVisible] = useState(false), pageVisible = usePageVisible();
  useEffect(() => {
    if (!active) { setWatching(false); return; }
    const request = new AbortController();
    // An intermittent refresh failure should not tear down a playing stream.
    void loadGameBroadcasts(appId, request.signal).then(value => { if (!request.signal.aborted) setItems(value); }, () => {});
    const timer = window.setTimeout(() => setRevision(n => n + 1), 60_000);
    return () => { request.abort(); window.clearTimeout(timer); };
  }, [appId, active, revision]);
  const broadcast = items.find(item => item.steamId === selected) ?? items[0];
  useEffect(() => { setWatching(false); }, [broadcast?.steamId]);
  useEffect(() => { const element = root.current; if (element) return observe(element, setVisible); }, [broadcast?.steamId]);
  if (!broadcast) return null;
  return <section ref={root} className="games-live-broadcast games-inset" data-attention={expanded && active && visible && pageVisible && !watching || undefined}>
    <button className="games-live-broadcast-heading" aria-expanded={expanded} aria-controls={`broadcast-${appId}`} onClick={() => { setRevealed(true); setExpanded(value => !value); setWatching(false); }}>
      <Radio size={17}/><span className="games-live-broadcast-title"><strong>{t("games.details.broadcast")}</strong><span>{broadcast.title}</span></span>
      <span className="games-live-broadcast-viewers"><i className="games-broadcast-live-dot" aria-hidden="true"/>{t("games.details.broadcastViewers", { count: broadcast.viewers.toLocaleString() })}</span><ChevronDown className="games-broadcast-chevron" size={17} aria-hidden="true"/>
    </button>
    <div id={`broadcast-${appId}`} className="games-broadcast-reveal" data-expanded={expanded} aria-hidden={!expanded} inert={!expanded}><div className="games-broadcast-clip">{revealed && <div className="games-live-broadcast-content">
      <div className="games-live-broadcast-preview">
        {broadcast.left && <img className="games-broadcast-wing" src={broadcast.left} alt="" loading="lazy"/>}
        <div>{watching && expanded && active ? <GameBroadcastPlayer key={broadcast.steamId} broadcast={broadcast}/> : <>
          {broadcast.thumbnail && <img src={broadcast.thumbnail} alt="" loading="lazy"/>}
          <button className="games-broadcast-watch" onClick={() => { setSelected(broadcast.steamId); setWatching(true); }}><span className="games-broadcast-watch-icon" aria-hidden="true"><Play size={30}/></span><span className="games-broadcast-watch-label">{t("games.details.broadcastPlay")}</span></button>
        </>}</div>
        {broadcast.right && <img className="games-broadcast-wing" src={broadcast.right} alt="" loading="lazy"/>}
      </div>
      <footer><small>{t("games.details.broadcastSource")}</small><div className="games-broadcast-links">
        {watching && <button onClick={() => setWatching(false)} aria-label={t("common.close")}><X size={14}/></button>}
        <a href={broadcast.url} onClick={event => { event.preventDefault(); openUrl(broadcast.url); }}>{t("games.details.broadcastWatch")}<ArrowUpRight size={12}/></a>
      </div>{items.length > 1 && <div>{items.map(item => <button key={item.steamId} aria-pressed={broadcast.steamId === item.steamId} onClick={() => { setWatching(false); setSelected(item.steamId); }}>{item.title || t("games.details.broadcast")} · {item.viewers.toLocaleString()}</button>)}</div>}</footer>
    </div>}</div></div>
  </section>;
}
