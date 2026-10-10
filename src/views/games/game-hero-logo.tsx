import { useEffect, useState } from "react";
import { decodeGameLogo, gameLogoSource, type GameLogoArt } from "@/lib/games/logo-art";
import { retroHeroLogos, RETRO_LOGO_FOLDERS } from "@/lib/games/hero-logo-data";

export function GameHeroLogo({ sources, name, steamId, platformIds, alternativeNames = [], gameType, ready, active, className = "games-game-logo", preferCurrentSteamLogo = false }: {
  sources: (string | undefined)[]; name: string; steamId?: number; platformIds: number[];
  alternativeNames?: string[]; gameType?: number; ready: boolean; active: boolean; className?: string; preferCurrentSteamLogo?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]), [remote, setRemote] = useState<string[]>([]);
  const [art, setArt] = useState<GameLogoArt>();
  // Verified publisher corrections also take precedence over persisted Steam snapshots.
  const publisherLogo = steamId ? gameLogoSource(steamId, "") : "";
  const supplied = publisherLogo ? [publisherLogo] : sources;
  const upgrade = !!steamId && preferCurrentSteamLogo && !publisherLogo;
  const source = (upgrade ? [...remote, ...supplied] : [...supplied, ...remote]).find((url): url is string => !!url && !failed.includes(url));
  useEffect(() => {
    if (!source) return;
    let current = true;
    void decodeGameLogo(source, steamId).then(logo => {
      if (!current) return;
      if (logo) setArt(logo);
      else setFailed(previous => [...previous, source]);
    });
    return () => { current = false; };
  }, [source, steamId]);
  // Late atlas enrichment must not cancel/restart a Steam logo request.
  const platforms = steamId ? "" : platformIds.join(","), names = steamId ? "" : [name, ...alternativeNames].join("\n");
  const retroType = steamId ? undefined : gameType;
  // A failed corrected logo should leave the readable title, not revive a known-bad variant.
  const needsRemote = active && ready && !publisherLogo && !remote.length && (!source || upgrade);
  useEffect(() => {
    if (!needsRemote) return;
    const request = new AbortController();
    if (steamId) {
      void import("@/lib/games/hero-logo").then(module => module.loadSteamHeroLogo(steamId, request.signal)).then(src => {
        if (!request.signal.aborted && src) setRemote([src]);
      }).catch(() => {});
    } else if (platforms.split(",").some(id => Object.hasOwn(RETRO_LOGO_FOLDERS, id))) {
      void import("@/lib/games/retro-logo-index.json").then(({default: index}) => {
        if (!request.signal.aborted) setRemote(retroHeroLogos(index, names.split("\n"), platforms.split(",").map(Number), retroType));
      }).catch(() => {});
    }
    return () => request.abort();
  }, [needsRemote, steamId, platforms, names, retroType]);
  // Keep a decoded mark visible while the current high-resolution source loads.
  if (!art || failed.includes(art.src)) return <span className={`${className} games-art-empty`} aria-hidden="true"/>;
  return <svg className={className} viewBox={art.viewBox} preserveAspectRatio="xMinYMid meet" aria-hidden="true" data-loaded="true" data-logo-shape={art.shape}>
    <image style={{filter: art.white ? "brightness(0) invert(1)" : undefined}} href={art.src} width={art.width} height={art.height}/>
  </svg>;
}
