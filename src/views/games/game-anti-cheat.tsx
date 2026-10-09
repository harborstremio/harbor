import { useEffect, useState } from "react";
import { ArrowUpRight, Shield } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadGameAntiCheat } from "@/lib/games/anti-cheat";
import { antiCheatArt } from "@/lib/games/anti-cheat-art";
import { antiCheatWithCategories, publisherAntiCheat, UNKNOWN_ANTI_CHEAT, type GameAntiCheat } from "@/lib/games/anti-cheat-data";
import { DetailDisclosure } from "./game-detail-disclosure";
import "./game-anti-cheat.css";

function AntiCheatSystem({ name }: { name: string }) {
  const art = antiCheatArt(name);
  const [failed, setFailed] = useState(false);
  return <div className="games-anti-cheat-system">
    <span className={`games-anti-cheat-logo${art?.shape === "wide" ? " is-wide" : ""}${art?.lightBackdrop && !failed ? " is-light" : ""}${!art || failed ? " is-fallback" : ""}`} aria-hidden="true">
      {art && !failed ? <img src={art.src} alt="" decoding="async" onError={() => setFailed(true)} /> : <Shield size={24}/>}
    </span>
    <strong>{name}</strong>
  </div>;
}

export function GameAntiCheatDetails({ appId, name, categories = [], active }: { appId?: number; name: string; categories?: number[]; active: boolean }) {
  const t = useT();
  const [result, setResult] = useState<{ appId: number; info: GameAntiCheat } | null>(null);
  const [loading, setLoading] = useState(!!appId);
  useEffect(() => {
    if (!active || !appId) { setLoading(false); return; }
    const request = new AbortController();
    setLoading(true);
    void loadGameAntiCheat(appId, request.signal).then(info => {
      if (!request.signal.aborted) setResult({ appId, info });
    }, () => {
      if (!request.signal.aborted) setResult({ appId, info: UNKNOWN_ANTI_CHEAT });
    }).finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [appId, active]);
  const info = antiCheatWithCategories(result && result.appId === appId ? result.info : publisherAntiCheat(name) ?? UNKNOWN_ANTI_CHEAT, categories);
  const label = info.status === "reported" ? info.systems.join(" · ") : t("games.antiCheat.unknown");
  return <DetailDisclosure title={t("games.antiCheat.title")} icon={<Shield size={22} />} note={loading && info.status === "unknown" ? t("common.loading") : label}>
    <div className="games-anti-cheat" aria-busy={loading}>
      {loading && info.status === "unknown" ? <div className="games-anti-cheat-skeleton" aria-hidden="true"/> : info.status === "reported" ? info.systems.map(system => <AntiCheatSystem key={system} name={system}/>) : <strong>{label}</strong>}
      {info.kernel === true && <span>{t("games.antiCheat.kernel")}</span>}
      {!loading && info.status === "unknown" && <p>{t("games.antiCheat.unavailable")}</p>}
      {info.sourceUrl && <a href={info.sourceUrl} onClick={event => { event.preventDefault(); void openUrl(info.sourceUrl!); }}>{t("games.antiCheat.source", { source: info.sourceName ?? "Steam" })}<ArrowUpRight size={13} aria-hidden="true"/></a>}
    </div>
  </DetailDisclosure>;
}
