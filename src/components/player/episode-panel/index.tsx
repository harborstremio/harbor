import { ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import type { PanelCorner } from "@/lib/player-chrome";
import { useSettings } from "@/lib/settings";
import { spoilerMaskFor } from "@/lib/spoilers";
import { registerStreamProxy } from "@/lib/stream-proxy";
import { preflightCheck } from "@/lib/streams/preflight";
import { resolveStream } from "@/lib/streams/resolve";
import type { ScoredStream } from "@/lib/streams/types";
import { useView, type PlayEpisode } from "@/lib/view";
import { playLocalAware } from "@/lib/local-library/playback";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { useT } from "@/lib/i18n";
import { EpisodeRow } from "./episode-row";
import { SeasonPicker } from "./season-picker";
import { StreamsView } from "./streams-view";
import { useSeasonBrowser } from "./use-season-browser";

function sameEpisode(a: PlayEpisode, b: PlayEpisode): boolean {
  if (a.kitsuStreamId && b.kitsuStreamId) return a.kitsuStreamId === b.kitsuStreamId;
  return (
    (a.imdbSeason ?? a.season) === (b.imdbSeason ?? b.season) &&
    (a.imdbEpisode ?? a.episode) === (b.imdbEpisode ?? b.episode)
  );
}

export function EpisodePanel({
  open,
  onClose,
  meta,
  currentEpisode,
  corner = "top-right",
  roomGuest = false,
  onHostAdvance,
  watchedFor,
  nextEp,
  onRestart,
}: {
  open: boolean;
  onClose: () => void;
  meta: Meta;
  currentEpisode: PlayEpisode | undefined;
  corner?: PanelCorner;
  roomGuest?: boolean;
  onHostAdvance?: (ep: PlayEpisode) => void;
  watchedFor?: (ep: PlayEpisode) => boolean;
  nextEp?: PlayEpisode | null;
  onRestart?: () => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const { openPicker, replacePlayerSrc } = useView();
  const debrids = useDebridClients();
  const { seasons, season, setSeason, episodes, loading } = useSeasonBrowser(
    meta,
    currentEpisode,
    open,
  );
  const nextSeason = seasons.find((n) => n > season);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [season]);
  const [expandedEp, setExpandedEp] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<PlayEpisode | null>(null);
  const [resolvingFor, setResolvingFor] = useState<PlayEpisode | null>(null);
  useEffect(() => {
    if (!open) {
      setExpandedEp(null);
      setPickingFor(null);
      setResolvingFor(null);
    }
  }, [open]);
  const manualMode = !settings.instantPlay;
  const handlePlay = (ep: PlayEpisode) => {
    if (roomGuest) return;
    const streamFlow = () => {
      if (manualMode) {
        setPickingFor(ep);
      } else {
        onClose();
        openPicker(meta, ep, { autoPlay: true });
      }
    };
    playLocalAware({
      meta,
      episode: ep,
      mode: settings.localPlaybackMode,
      source: "manual",
      playLocal: (e, o) => {
        onClose();
        replacePlayerSrc({ ...localPlayerSrc(e), startFromZero: o?.fromStart });
      },
      playStream: streamFlow,
      setMode: (m) => update({ localPlaybackMode: m }),
    });
  };
  const handlePickStream = async (stream: ScoredStream) => {
    if (!pickingFor || roomGuest) return;
    if (!stream.url && stream.externalUrl) return;
    const ep = pickingFor;
    setResolvingFor(ep);
    try {
      const hint = { season: ep.season ?? null, episode: ep.episode ?? null };
      const r = await resolveStream(
        stream,
        debrids,
        new AbortController().signal,
        true,
        false,
        hint,
      );
      if (!r.ok) {
        setResolvingFor(null);
        return;
      }
      let playUrl = r.data.url;
      if (r.data.headers && Object.keys(r.data.headers).length > 0) {
        try {
          const proxied = await registerStreamProxy(r.data.url, r.data.headers);
          playUrl = proxied.url;
        } catch {
          setResolvingFor(null);
          return;
        }
      }
      const skipPreflight = r.via === "p2p" || r.via === "direct";
      const preflight = skipPreflight
        ? ({ ok: true } as const)
        : await preflightCheck(playUrl).catch(() => ({ ok: true }) as const);
      if (!preflight.ok && preflight.reason === "stub") {
        setResolvingFor(null);
        return;
      }
      onHostAdvance?.(ep);
      replacePlayerSrc({
        meta,
        episode: ep,
        url: playUrl,
        title: stream.parsedTitle ?? stream.title ?? stream.name ?? meta.name,
        notWebReady: !stream.url && !!stream.infoHash,
        subtitles: [],
        streamRef: {
          infoHash: stream.infoHash ?? null,
          fileIdx: r.data.fileIdx ?? stream.fileIdx ?? null,
          addonId: stream.addonId ?? null,
          title: stream.title ?? null,
          parsedTitle: stream.parsedTitle ?? null,
          resolution: stream.resolution ?? null,
          source: stream.source ?? null,
          size: stream.size ?? null,
        },
      });
      onClose();
    } catch {
      setResolvingFor(null);
    }
  };
  return (
    <div
      aria-hidden={!open}
      data-tv-focus-scope={open || undefined}
      inert={!open ? true : undefined}
      className={`pointer-events-${open ? "auto" : "none"} absolute inset-0 z-30`}
    >
      {resolvingFor && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/82 backdrop-blur-md animate-in fade-in duration-150">
          <HarborLoader size="md" caption={t("Connecting")} />
          <p className="text-[13px] text-white/75">
            {t("Loading {label}", {
              label: `S${resolvingFor.imdbSeason ?? resolvingFor.season} · E${String(resolvingFor.imdbEpisode ?? resolvingFor.episode).padStart(2, "0")}${
                resolvingFor.name ? ` · ${resolvingFor.name}` : ""
              }`,
            })}
          </p>
        </div>
      )}
      <button
        aria-label={t("Dismiss episode panel")}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 cursor-default bg-black/35 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label={t("Up next")}
        className={`absolute top-0 h-full w-full max-w-[440px] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-out ${
          corner === "top-left" || corner === "bottom-left" ? "left-0" : "right-0"
        } ${
          open
            ? "translate-x-0"
            : corner === "top-left" || corner === "bottom-left"
              ? "-translate-x-full"
              : "translate-x-full"
        }`}
      >
        <ThreeLiquidGlassSurface
          radius={
            corner === "top-left" || corner === "bottom-left" ? "0 24px 24px 0" : "24px 0 0 24px"
          }
          shaderRadius={0.42}
          intensity={0.1}
          refractionStrength={0.62}
          lensStrength={0.9}
          causticsStrength={0.06}
          motionSpeed={0.5}
          interactive={false}
          alwaysActive
          style={{
            background:
              "linear-gradient(145deg, rgba(8,12,18,0.36), rgba(8,12,18,0.30) 48%, rgba(8,12,18,0.34))",
            boxShadow:
              corner === "top-left" || corner === "bottom-left"
                ? "inset -1px 0 0 rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.08)"
                : "inset 1px 0 0 rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.08)",
          }}
          className={`h-full w-full ${
            corner === "top-left" || corner === "bottom-left" ? "border-r" : "border-l"
          } border-white/[0.10]`}
          contentClassName="relative h-full w-full overflow-hidden"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-[#080c12]/55" />
          <div className="relative z-10 flex h-full w-full flex-col">
            {pickingFor ? (
              <StreamsView
                meta={meta}
                episode={pickingFor}
                onBack={() => setPickingFor(null)}
                onClose={onClose}
                onPick={handlePickStream}
              />
            ) : (
              <>
                <header className="flex items-center justify-between gap-3 px-6 pb-4 pt-7">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
                      {t("Up Next")}
                    </p>
                    <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
                      {meta.name}
                    </h2>
                  </div>
                  <ThreeLiquidGlassSurface
                    radius="9999px"
                    shaderRadius={0.5}
                    intensity={0.1}
                    refractionStrength={0.78}
                    lensStrength={1}
                    causticsStrength={0.05}
                    motionSpeed={0.5}
                    interactive={false}
                    alwaysActive
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.018))",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.08)",
                    }}
                    className="h-11 w-11 shrink-0 border border-white/[0.12]"
                    contentClassName="flex h-full w-full"
                  >
                    <button
                      aria-label={t("Close")}
                      onClick={onClose}
                      data-tv-modal-close
                      className="
                    flex h-full w-full items-center justify-center rounded-full
                    bg-transparent text-ink-muted
                    transition-[color,transform]
                    hover:text-ink active:scale-[0.96]
                  "
                    >
                      <X size={18} strokeWidth={2.2} />
                    </button>
                  </ThreeLiquidGlassSurface>
                </header>
                <div className="flex items-center justify-between gap-3 px-6 pb-3">
                  {currentEpisode ? (
                    <p className="min-w-0 truncate text-[12.5px] text-ink-subtle">
                      {t("Now playing: {label}", {
                        label: `S${currentEpisode.imdbSeason ?? currentEpisode.season} · E${String(currentEpisode.imdbEpisode ?? currentEpisode.episode).padStart(2, "0")}${
                          currentEpisode.name ? ` · ${currentEpisode.name}` : ""
                        }`,
                      })}
                    </p>
                  ) : (
                    <span />
                  )}
                  {seasons.length > 1 && (
                    <SeasonPicker seasons={seasons} active={season} onChange={setSeason} />
                  )}
                </div>
                <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
                  {loading && episodes.length === 0 && (
                    <div className="flex items-center justify-center py-16">
                      <HarborLoader size="sm" />
                    </div>
                  )}
                  {!loading && episodes.length === 0 && (
                    <p className="px-2 py-10 text-center text-[13.5px] text-ink-muted">
                      {t("No episodes found for this season.")}
                    </p>
                  )}
                  {episodes.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {episodes.map((ep) => {
                        const key = `${ep.season}:${ep.episode}`;
                        const isCurrent = !!currentEpisode && sameEpisode(ep, currentEpisode);
                        const isNextUp = !!nextEp && sameEpisode(ep, nextEp);
                        return (
                          <EpisodeRow
                            key={key}
                            episode={ep}
                            expanded={expandedEp === key}
                            onToggle={() => setExpandedEp((cur) => (cur === key ? null : key))}
                            onPlay={() => {
                              if (isCurrent) {
                                if (roomGuest) return;
                                onRestart?.();
                                onClose();
                              } else {
                                handlePlay(ep);
                              }
                            }}
                            isCurrent={isCurrent}
                            watched={watchedFor?.(ep) ?? false}
                            spoiler={spoilerMaskFor(settings, {
                              watched: isCurrent || (watchedFor?.(ep) ?? false),
                              isNextUp,
                            })}
                          />
                        );
                      })}
                    </div>
                  )}
                  {!loading && nextSeason !== undefined && (
                    <button
                      onClick={() => setSeason(nextSeason)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-elevated px-4 py-3.5 text-[13.5px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
                    >
                      {t("Season {n}", { n: nextSeason })}
                      <ChevronRight size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
                <footer className="border-t border-edge-soft/60 px-6 py-4 text-[12px] text-ink-subtle">
                  {manualMode
                    ? t("Manual mode: clicking Play opens the source picker here.")
                    : t("Instant Play: clicking Play queues the next stream automatically.")}
                </footer>
              </>
            )}
          </div>
        </ThreeLiquidGlassSurface>
      </aside>
    </div>
  );
}
