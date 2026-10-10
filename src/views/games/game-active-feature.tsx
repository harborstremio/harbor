import { useEffect, useState } from "react";
import { loadGameDetail } from "@/lib/games/catalog";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { RatingMark } from "./game-discovery-ratings";
import { HoverTooltip } from "@/components/hover-tooltip";
import { decodeGameLogo, gameLogoSource, type GameLogoArt } from "@/lib/games/logo-art";
import { launcherTitleLogo } from "@/lib/games/launcher-title-art";
import { AudiencePlatformMark } from "./game-audience-marks";

type FeatureGame = GameSummary & { hero?: string; logo?: string; description?: string; sourceUrl?: string; openGame?: GameSummary };
type Preview = { game: FeatureGame; detail?: GameDetail; art?: string; logo?: GameLogoArt; previousArt?: string };

/** Keep the current preview intact until the next title's actual artwork is decoded. */
export function GameActiveFeature({ game, active, open }: {
  game: FeatureGame; active: boolean; open: (game: GameSummary) => void;
}) {
  const t = useT();
  const [preview, setPreview] = useState<Preview>();
  useEffect(() => {
    if (!active) return;
    const request = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      const detail = game.steamId ? await loadGameDetail(game.steamId).catch(() => undefined) : undefined;
      if (!current) return;
      const [art, logo] = await Promise.all([
        firstDecoded([game.hero, detail?.screenshots[0], detail?.libraryHero, game.capsule]),
        loadFeatureLogo(game, detail, request.signal),
      ]);
      if (current) setPreview(previous => ({ game, detail, art, logo, previousArt: previous?.art }));
    }, 140);
    return () => { current = false; clearTimeout(timer); request.abort(); };
  }, [game.id, game.openGame?.id, game.hero, game.logo, game.capsule, active]);

  return <div className="games-active-scene" aria-busy={!preview || preview.game.id !== game.id} data-game={preview?.game.id}>
    {preview?.previousArt && <img className="games-active-art is-previous" src={preview.previousArt} alt="" />}
    {preview?.art && <img key={preview.art} className="games-active-art" src={preview.art} alt="" />}
    <div className="games-active-shade" />
    {preview ? <div className="games-active-scene-copy" key={preview.game.id}>
      <div className="games-active-title">
        {preview.logo && <svg className="games-active-game-logo" data-logo-shape={preview.logo.shape} viewBox={preview.logo.viewBox} preserveAspectRatio="xMinYMid meet" aria-hidden="true"><image style={{filter: preview.logo.white ? "brightness(0) invert(1)" : undefined}} href={preview.logo.src} width={preview.logo.width} height={preview.logo.height} /></svg>}
        <h3 className={preview.logo?.shape === "wide" ? "sr-only" : undefined}>{preview.game.name}</h3>
      </div>
      <div className="games-active-actions">
        <button className="games-feature-link" onClick={() => open(preview.game.openGame ?? preview.game)}>{t("games.discovery.viewGame")}</button>
        {(preview.detail?.description || preview.game.description) && <HoverTooltip label={preview.game.name} sublabel={preview.detail?.description || preview.game.description} arrow large side="top"><button className="games-active-about" aria-label={t("games.about")}>{t("games.discovery.about")}</button></HoverTooltip>}
        {preview.game.steamId && <HoverTooltip label={t("games.steam")} mark={<RatingMark source="steam" />} arrow side="top" align="center"><a className="games-active-steam" aria-label={t("games.steam")} href={`https://store.steampowered.com/app/${preview.game.steamId}/`} onClick={event => { event.preventDefault(); openUrl(event.currentTarget.href); }}><RatingMark source="steam" /></a></HoverTooltip>}
        {preview.game.sourceUrl && <HoverTooltip label={t("games.audience.xboxView")} arrow side="top" align="center"><a className="games-active-steam" aria-label={t("games.audience.xboxView")} href={preview.game.sourceUrl} onClick={event => { event.preventDefault(); openUrl(event.currentTarget.href); }}><AudiencePlatformMark board="xbox"/></a></HoverTooltip>}
      </div>
    </div> : <div className="games-active-scene-copy games-active-feature-loading" aria-label={t("games.charts.loading")} role="status"><i /><i /></div>}
  </div>;
}

async function loadFeatureLogo(game: FeatureGame, detail: GameDetail | undefined, signal: AbortSignal): Promise<GameLogoArt | undefined> {
  const supplied = launcherTitleLogo(game.igdbId) || game.logo || (game.steamId ? gameLogoSource(game.steamId, "") : undefined);
  if (supplied) { const art = await decodeGameLogo(supplied, game.steamId); if (art) return art; }
  if (game.steamId && !signal.aborted) {
    const { loadSteamHeroLogo } = await import("@/lib/games/hero-logo");
    const src = await loadSteamHeroLogo(game.steamId, AbortSignal.any([signal, AbortSignal.timeout(10_000)])).catch(() => undefined);
    if (src) { const art = await decodeGameLogo(src, game.steamId); if (art) return art; }
  }
  return decodeGameLogo(detail?.logo, game.steamId);
}

async function firstDecoded(candidates: (string | undefined)[]): Promise<string | undefined> {
  for (const src of candidates) {
    if (!src) continue;
    const image = new Image();
    image.src = src;
    if (await image.decode().then(() => true, () => false)) return src;
  }
}

/** Harbor's player group mark, kept legible beside compact live counts. */
export function PlayersMark() {
  return <svg className="games-players-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3.1" /><path d="M3 20v-3a6 6 0 0 1 12 0v3H3ZM16.5 4.7a3.1 3.1 0 0 1 0 6M18 13.3a5.2 5.2 0 0 1 3 4.7v2h-3" /></svg>;
}
