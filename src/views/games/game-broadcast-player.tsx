import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { broadcastHeartbeat, loadBroadcastPlayback } from "@/lib/games/broadcast-player";
import type { BroadcastPlayback } from "@/lib/games/broadcast-player-data";
import type { GameBroadcast } from "@/lib/games/detail-extras-data";
import { GameTrailer } from "./game-trailer";

export function GameBroadcastPlayer({ broadcast }: { broadcast: GameBroadcast }) {
  const t = useT();
  const [playback, setPlayback] = useState<BroadcastPlayback>(), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => {
    const request = new AbortController(); setFailed(false); setPlayback(undefined);
    void loadBroadcastPlayback(broadcast.steamId, request.signal).then(value => { if (!request.signal.aborted) setPlayback(value); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [broadcast.steamId, attempt]);
  useEffect(() => {
    if (!playback || !playing) return;
    const request = new AbortController();
    const timer = window.setInterval(() => { void broadcastHeartbeat(broadcast.steamId, playback, request.signal).catch(() => {}); }, playback.heartbeatSeconds * 1000);
    return () => { clearInterval(timer); request.abort(); };
  }, [broadcast.steamId, playback, playing]);
  return <div className="games-broadcast-player">
    {playback && !failed ? <GameTrailer key={`${broadcast.steamId}:${attempt}`} url={playback.hlsUrl} poster={broadcast.thumbnail} active intentional live onPlaybackChange={setPlaying} onError={() => { setPlaying(false); setFailed(true); }}/> : <div className="games-broadcast-player-state" role={failed ? "alert" : "status"}>
      {broadcast.thumbnail && <img src={broadcast.thumbnail} alt=""/>}<span>{t(failed ? "games.player.error" : "games.player.buffering")}</span>{failed && <button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button>}
    </div>}
  </div>;
}
