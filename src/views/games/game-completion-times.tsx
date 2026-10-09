import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { loadCompletionTimes } from "@/lib/games/completion-times";
import type { GameCompletionTimes } from "@/lib/games/completion-time-data";
import { DetailDisclosure } from "./game-detail-disclosure";

export function GameCompletionTime({ gameId, active }: { gameId?: number; active: boolean }) {
  const t = useT(), [data, setData] = useState<GameCompletionTimes | null>(null);
  useEffect(() => {
    if (!gameId || !active) return;
    const request = new AbortController(); setData(null);
    void loadCompletionTimes(gameId, request.signal).then(value => { if (!request.signal.aborted) setData(value); }, () => { if (!request.signal.aborted) setData(null); });
    return () => request.abort();
  }, [gameId, active]);
  if (!data) return null;
  return <DetailDisclosure title={t("games.details.completionTimes")} icon={<Clock3 size={22}/>}><div className="games-completion-times">{(["main", "extras", "complete"] as const).flatMap(key => data[key] ? [<div key={key}><span>{t(`games.details.completion.${key}`)}</span><strong>{t("games.details.hours", { count: (data[key]! / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 }) })}</strong></div>] : [])}<p><img className="games-rating-brand-igdb" src="/games/brands/igdb.svg" alt="IGDB"/>{t("games.details.completionSamples", { count: data.count.toLocaleString() })}</p></div></DetailDisclosure>;
}
