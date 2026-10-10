import { HoverTooltip } from "@/components/hover-tooltip";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { startMusicSurprise, stopMusicSurprise, useMusicSurprise } from "@/lib/music/surprise-me";
import { MusicSurpriseIcon } from "./music-surprise-icon";
import type { MusicCatalogRow } from "@/lib/music/types";
import "./music-surprise-button.css";

export function MusicSurpriseButton({ genres, homeRows, spotifyConnected, onChooseTastes }: { genres: readonly number[]; homeRows: readonly MusicCatalogRow[]; spotifyConnected: boolean; onChooseTastes: () => void }) {
  const t = useT(), status = useMusicSurprise();
  const [rolling, setRolling] = useState(status === "loading");
  useEffect(() => {
    if (status === "loading") setRolling(true);
    else if (matchMedia("(prefers-reduced-motion: reduce)").matches) setRolling(false);
  }, [status]);
  const active = status === "playing" || status === "loading" || status === "waiting";
  const message = status === "empty" ? t("music.surprise.empty") : status === "error" ? t("music.surprise.error") : null;
  const label = t(active ? "music.surprise.stop" : "music.surprise.title");
  return <div className="music-surprise-entry">
    <HoverTooltip label={label} sublabel={t(status === "loading" ? "music.surprise.loading" : status === "waiting" ? "music.surprise.waiting" : "music.surprise.body")} align="end">
      <button type="button" className="music-quick-entry music-surprise-button" aria-label={label}
        aria-pressed={active} data-loading={rolling || undefined}
        onAnimationIteration={() => { if (status !== "loading") setRolling(false); }}
        onClick={() => active ? stopMusicSurprise() : void startMusicSurprise(genres, t("music.surprise.title"), homeRows, spotifyConnected)}>
        <MusicSurpriseIcon />
      </button>
    </HoverTooltip>
    <span className="sr-only" role="status">{status === "loading" ? t("music.surprise.loading") : status === "waiting" ? t("music.surprise.waiting") : ""}</span>
    {message && <div className="music-surprise-message" role="status"><p>{message}</p>
      {status === "empty" && <button type="button" onClick={onChooseTastes}>{t("music.taste.choose")}</button>}
    </div>}
  </div>;
}
