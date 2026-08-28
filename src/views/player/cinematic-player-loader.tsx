import { useEffect, useRef, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { isLocalUrl } from "@/lib/player/local-url";
import type { PlayerSrc } from "@/lib/view";
import { Topbar } from "@/chrome/topbar";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { useTitleLogo } from "@/lib/title-logo";
import { LoaderLogoOrText } from "./loader-logo-or-text";
import { readinessScore, type EngineStats } from "@/lib/torrent/engine-stats";
import { isBundledEngineUrl, isLocalEngineUrl } from "@/lib/stremio-server";
import { StreamLoadingBar } from "./stream-loading-bar";
import { useP2pPreparingStatus } from "./use-p2p-preparing-status";
import { useMedia } from "@/components/hover-preview/scene";

const LOADER_BUBBLES = [8, 20, 33, 47, 60, 72, 85, 94];

function fmtSpeed(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return "warming up";
}

export function CinematicPlayerLoader({
  src,
  snap,
  forceShow,
  failed,
  onCancel,
  engineStats,
  onShowingChange,
}: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  forceShow?: boolean;
  failed?: boolean;
  onCancel: () => void;
  engineStats?: EngineStats | null;
  onShowingChange?: (showing: boolean) => void;
}) {
  const t = useT();
  const kid = useActiveKid();
  const pinnedLogo = useTitleLogo(src.meta.id);
  const isLocal = isLocalUrl(src.url);
  const isInfoHash =
    (isBundledEngineUrl(src.url) || isLocalEngineUrl(src.url)) && !src.url.includes("/hlsv2/");
  const isLocalEngine = isLocalEngineUrl(src.url) && !!src.streamRef?.infoHash;
  const enginePeers = engineStats
    ? engineStats.unchoked > 0
      ? engineStats.unchoked
      : engineStats.peers
    : 0;
  const engineSpeed = engineStats?.downloadSpeed ?? 0;
  const showEngineActivity = isInfoHash && !!engineStats && (enginePeers > 0 || engineSpeed > 0);
  const streamBytes = src.streamRef?.size ?? engineStats?.streamLen ?? null;
  const ready = isInfoHash ? readinessScore(engineStats ?? null, true) : 0;
  const heavyForP2p = isInfoHash && streamBytes != null && streamBytes > 20 * 1024 ** 3;
  const everPlayedRef = useRef(false);
  if (snap.firstFrameReady) {
    everPlayedRef.current = true;
  }
  const sessionKey = `${src.meta.id}::${src.episode?.season ?? ""}:${src.episode?.episode ?? ""}`;
  const lastSessionRef = useRef(sessionKey);
  if (lastSessionRef.current !== sessionKey) {
    lastSessionRef.current = sessionKey;
    everPlayedRef.current = false;
  }
  const showing =
    forceShow ||
    (!everPlayedRef.current && !failed && snap.errorCode == null && snap.status !== "ended");
  const done = !showing && snap.errorCode == null;
  const [mounted, setMounted] = useState(showing);
  useEffect(() => {
    onShowingChange?.(showing);
  }, [showing, onShowingChange]);
  useEffect(() => () => onShowingChange?.(false), [onShowingChange]);
  useEffect(() => {
    if (showing) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [showing]);
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const prep = useP2pPreparingStatus({
    url: src.url,
    infoHash: src.streamRef?.infoHash ?? null,
    fileIdx: src.streamRef?.fileIdx ?? null,
    active: showing && isLocalEngine,
  });
  if (!mounted) return null;
  const backdrop = src.episode?.still || src.meta.background || src.meta.poster;
  return (
    <div
      data-tauri-drag-region
      className={`absolute inset-0 z-[80] overflow-hidden transition-opacity duration-300 ${
        kid ? "bg-[#0c4a6e]" : "bg-black"
      } ${showing ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <Topbar connecting />
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover saturate-150 ${
            kid ? "opacity-20 blur-[36px]" : "opacity-40 blur-[28px]"
          }`}
        />
      )}
      <div
        className={`absolute inset-0 ${
          kid
            ? "bg-gradient-to-b from-[#3aa6c4]/85 via-[#1c789f]/88 to-[#0a3d5c]/94"
            : "bg-gradient-to-b from-black/65 via-black/55 to-black/85"
        }`}
      />
      {kid && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {LOADER_BUBBLES.map((left, i) => (
            <span
              key={i}
              className="curfew-bubble absolute bottom-0 rounded-full bg-white/25"
              style={{
                left: `${left}%`,
                width: 12 + (i % 3) * 6,
                height: 12 + (i % 3) * 6,
                animationDelay: `-${(1 + ((i * 1.7) % 6)).toFixed(1)}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            />
          ))}
          <div className="curfew-bob absolute bottom-[14%] left-[10%]">
            <img
              src="/kids/doodles/liloctored.png"
              alt=""
              draggable={false}
              className="h-24 w-auto opacity-85"
            />
          </div>
          <img
            src="/kids/doodles/lilpurpocto.png"
            alt=""
            draggable={false}
            className="absolute bottom-[12%] right-[12%] h-20 w-auto opacity-75"
          />
          <img
            src="/kids/doodles/lilorangestar2.png"
            alt=""
            draggable={false}
            className="absolute right-[18%] top-[18%] h-10 w-auto opacity-90"
          />
        </div>
      )}
      <div
        data-tauri-drag-region
        className="relative flex h-full flex-col items-center justify-center gap-7 px-8 text-center"
      >
        <LoaderLogoOrText
          logo={pinnedLogo ?? src.meta.logo ?? null}
          fallbackText={src.meta.name ?? src.title}
        />
        {src.episode && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.32em] text-white/70">
            S{src.episode.imdbSeason ?? src.episode.season} · E
            {String(src.episode.imdbEpisode ?? src.episode.episode).padStart(2, "0")}
            {src.episode.name ? ` · ${src.episode.name}` : ""}
          </p>
        )}
        {isInfoHash ? (
          isLocalEngine && prep.phase === "no-peers" ? (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
              <p className="text-[12.5px] font-medium uppercase tracking-[0.18em] text-white/70">
                {t("No peers found")}
              </p>
              <p className="max-w-md text-[13.5px] leading-relaxed text-white/70">
                {t(
                  "Couldn't connect to any peers for this torrent. It may be unreachable on your network (some ISPs and VPNs block torrent traffic).",
                )}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onCancel}
                  className="flex h-11 cursor-pointer items-center rounded-full border border-white/20 bg-white/10 px-6 text-[13.5px] font-medium text-white/90 transition-colors hover:border-white/35 hover:bg-white/15"
                >
                  {t("Go back")}
                </button>
                <button
                  onClick={prep.retry}
                  className="flex h-11 cursor-pointer items-center rounded-full border border-white/12 bg-transparent px-6 text-[13.5px] font-medium text-white/70 transition-colors hover:border-white/25 hover:text-white"
                >
                  {t("Try again")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <StreamLoadingBar key={src.url} ready={ready} done={done} />
              <p className="text-[12.5px] font-medium uppercase tracking-[0.18em] text-white/70">
                {snap.buffering ? t("Buffering") : t("Preparing stream")}
              </p>
              {isLocalEngine && (
                <p className="flex items-center gap-2 text-[12.5px] font-medium tracking-wide text-white/55 tabular-nums">
                  {prep.phase === "searching" && (
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full bg-white/40 ${reducedMotion ? "" : "animate-pulse"}`}
                    />
                  )}
                  {prep.peers > 0
                    ? `${prep.peers} ${prep.peers === 1 ? t("peer") : t("peers")} · ${fmtSpeed(prep.downloadSpeed)}`
                    : t("Looking for peers…")}
                </p>
              )}
              {isLocalEngine && prep.phase === "slow" && (
                <p className="max-w-xs text-[12px] leading-relaxed text-amber-300/85">
                  {t("Found peers but no data yet. The torrent may be slow.")}
                </p>
              )}
            </div>
          )
        ) : (
          <HarborLoader size="md" caption={isLocal ? t("Loading") : t("Connecting")} />
        )}
        {!kid && showEngineActivity && !isLocalEngine && (
          <p className="text-[12.5px] font-medium tracking-wide text-white/50 tabular-nums">
            {enginePeers} {enginePeers === 1 ? t("peer") : t("peers")} · {fmtSpeed(engineSpeed)}
          </p>
        )}
        {!kid && heavyForP2p && (
          <p className="max-w-md text-[12.5px] leading-relaxed text-amber-300/85">
            {t(
              "Heads up: this is a large file for peer-to-peer streaming, so it can take a while to start. A 1080p source or a debrid service will load faster.",
            )}
          </p>
        )}
      </div>
      {!(isLocalEngine && prep.phase === "no-peers") && (
        <button
          onClick={onCancel}
          className="absolute bottom-10 left-1/2 z-10 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/45 px-6 text-[13.5px] font-medium text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-black/60 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3.5 3.5l7 7M10.5 3.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          {t("Cancel")}
        </button>
      )}
    </div>
  );
}
