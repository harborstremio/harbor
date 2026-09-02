import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Loader2, PackageX } from "lucide-react";
import { isCurrentStream } from "@/components/player/stream-switcher/switcher-row";
import type { Meta } from "@/lib/cinemeta";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { createMediaServerPlayerSrc } from "@/lib/media-server/playback";
import { decidePlaybackSource } from "@/lib/media-server/playback-policy";
import { useMediaServerHealth } from "@/hooks/use-media-server-health";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import type { ScoredStream } from "@/lib/streams/types";
import { type PlayEpisode } from "@/lib/view";
import {
  anyStreamCached,
  debridBanner,
  streamIdentity,
  translateDebridBannerTitle,
  translatePickerError,
  translatePipelineErrorTransport,
} from "@/views/play-picker/picker-utils";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { BpStreamChips, type BpSourceKind } from "./bp-stream-chips";
import {
  BpAutoExhaustedDialog,
  BpDebridDownDialog,
  BpNoSourcesDialog,
  BpP2pDialog,
} from "./bp-stream-dialogs";
import { BpHomeServerRow, BpLocalRow, BpStreamRow } from "./bp-stream-row";
import { BpAutoStep } from "./bp-stream-steps";
import { BpSubtitleStep } from "./bp-subtitle-step";
import { bpSurfaceVisible } from "./bp-visible";
import { bpFocusScope, recoverBpFocus } from "./use-bp-focus";
import { useBpPageModal } from "./use-bp-page-modal";
import { useBpStreamPlay } from "./use-bp-stream-play";
import { useBpStreams } from "./use-bp-streams";

export type BpStreamsProps = {
  meta: Meta;
  episode?: PlayEpisode;
  mode?: "pick" | "switch";
  resume?: boolean;
  autoPlay?: boolean;
  applyPreference?: boolean;
  intent?: "play" | "download";
  onClose: () => void;
  onPick?: (stream: ScoredStream) => void | Promise<void>;
  currentUrl?: string;
  currentInfoHash?: string | null;
  currentFileIdx?: number | null;
};

function BpStreamsBanner({ text, tone }: { text: string; tone: "error" | "info" }) {
  return (
    <p
      className={`mx-[var(--bp-gutter)] rounded-[var(--bp-r-sm)] border px-[clamp(15px,1.4vw,26px)] py-[clamp(10px,1.2vh,18px)] text-[clamp(12.5px,1.7vh,19px)] font-semibold ${
        tone === "error"
          ? "border-[var(--bp-edge-2)] bg-[var(--bp-panel)] text-ink"
          : "border-[var(--bp-edge)] bg-[var(--bp-panel)] text-ink-subtle"
      }`}
    >
      {text}
    </p>
  );
}

function BpLadderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className="h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
    >
      {label}
    </button>
  );
}

function BpSourceCell({ children }: { children: React.ReactNode }) {
  // Scoped so Left/Right shake in place. Without it the rows sit in free
  // spatial mode and horizontal moves escape up into the filter chips.
  return (
    <div data-bp-row data-bp-scroll-x style={{ containIntrinsicSize: "auto 96px" }}>
      {children}
    </div>
  );
}

// 60 rows is about 12,000px of list against a 641px canvas, so the sentinel
// stays far off screen until someone genuinely scrolls, and the count in the
// header keeps reporting the real total either way.
const STREAM_PAGE = 60;

// About twelve rows of lead. Large on purpose: the cost of extending early is a
// few mounted rows, and the cost of extending late is a swallowed D-pad press.
const STREAM_LEAD = "2400px";

const PAGE_SURFACE =
  "absolute inset-0 z-[60] flex flex-col bg-[var(--bp-void)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]";

// The in-player switcher sits over a running film, so it is a card and not a
// page. The frame matches the other player panels exactly, so flipping between
// them never resizes the surface. One --bp-gutter override retargets every
// inner padding and every [data-bp-row] negative margin at once.
const SWITCH_SURFACE =
  "flex h-[min(86vh,900px)] w-[min(92vw,1180px)] flex-col overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-void)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] [animation:bp-rise_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]";

const SWITCH_GUTTER = { "--bp-gutter": "clamp(20px,2.2vw,44px)" } as CSSProperties;

export function BpStreams({
  meta,
  episode,
  mode = "pick",
  resume,
  autoPlay,
  applyPreference = false,
  intent,
  onClose,
  onPick,
  currentUrl,
  currentInfoHash,
  currentFileIdx,
}: BpStreamsProps) {
  const t = useBpT();
  const { settings } = useSettings();
  // The switcher is a card over a running film and must never hide what is
  // behind it. Every other mode here is an opaque full-page surface.
  const setModalNode = useBpPageModal(mode !== "switch");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      setModalNode(el);
    },
    [setModalNode],
  );
  const s = useBpStreams({ meta, episode });
  const play = useBpStreamPlay({ meta, episode, s, autoPlay, resume, intent, onPick });
  const download = intent === "download";
  const switching = mode === "switch";
  // Picking a local file routes through openPlayer, which starts a second
  // session on top of the one being switched. The desktop switcher never
  // offered them either.
  const localFiles = download || switching ? [] : s.localFiles;
  const homeServerCopies = download || switching ? [] : s.homeServerCopies;
  const homeServerHealth = useMediaServerHealth(s.homeServerConnections);
  const [homeServerError, setHomeServerError] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<BpSourceKind>(() => {
    if (!applyPreference) return "all";
    if (settings.playbackSourcePreference === "local") return "local";
    if (settings.playbackSourcePreference === "home-server") return "media-server";
    return "all";
  });
  const showLocal = sourceKind === "all" || sourceKind === "local";
  const showHomeServers = sourceKind === "all" || sourceKind === "media-server";
  const showOnline = sourceKind === "all" || sourceKind === "online";
  const homeServerHealthReady = s.homeServerConnections.every(
    (connection) => (homeServerHealth[connection.id] ?? "checking") !== "checking",
  );
  const availableHomeServerCopies = homeServerCopies.filter(
    (copy) => copy.connectionId != null && homeServerHealth[copy.connectionId] === "active",
  );

  const playHomeServer = useCallback(
    async (copy: (typeof homeServerCopies)[number]) => {
      const connection = s.homeServerConnections.find((entry) => entry.id === copy.connectionId);
      const item = s.homeServerItems.find(
        (entry) => entry.connectionId === copy.connectionId && entry.id === copy.itemId,
      );
      if (!connection || !item) return;
      setHomeServerError(null);
      try {
        play.openLocal(
          await createMediaServerPlayerSrc({
            meta,
            imdbId: s.imdbId ?? undefined,
            episode,
            connection,
            item,
            versionId: copy.version.id,
          }),
        );
      } catch (cause) {
        setHomeServerError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [episode, homeServerCopies, meta, play, s.homeServerConnections, s.homeServerItems, s.imdbId],
  );

  const preferredSourceFired = useRef(false);
  useEffect(() => {
    preferredSourceFired.current = false;
  }, [meta.id, episode?.season, episode?.episode]);
  useEffect(() => {
    if (
      !applyPreference ||
      mode !== "pick" ||
      preferredSourceFired.current ||
      !s.homeServersLoaded ||
      !homeServerHealthReady
    )
      return;
    if (settings.playbackSourcePreference === "local" && localFiles.length === 0) {
      preferredSourceFired.current = true;
      setSourceKind("all");
      return;
    }
    if (settings.playbackSourcePreference === "local" && localFiles.length > 1) {
      preferredSourceFired.current = true;
      setSourceKind("local");
      return;
    }
    if (
      settings.playbackSourcePreference === "home-server" &&
      settings.preferredMediaServerId == null
    ) {
      preferredSourceFired.current = true;
      setSourceKind("media-server");
      return;
    }
    const decision = decidePlaybackSource(settings, localFiles.length, availableHomeServerCopies);
    if (decision.kind === "local" && localFiles[0]) {
      preferredSourceFired.current = true;
      play.openLocal(localPlayerSrc(localFiles[0], s.isAnime, episode));
    } else if (decision.kind === "home-server") {
      preferredSourceFired.current = true;
      void playHomeServer(decision.copy);
    }
  }, [
    applyPreference,
    availableHomeServerCopies,
    homeServerHealthReady,
    localFiles,
    mode,
    play,
    playHomeServer,
    s.homeServersLoaded,
    s.isAnime,
    settings,
  ]);

  // Claimed only while this surface owns the focus scope, so a dialog opened on
  // top of it still gets Back first. Resolved from this element and never from
  // a document-wide query: in the player this lives under a portalled
  // [data-bp-player-surface], and a document query finds the shell's root.
  //
  // The visibility test is the other half. bp-shell keeps the source list
  // mounted across a playback session so Back out of a dead stream lands on the
  // list again, but it also drops visibility:hidden on its root, and a list
  // nobody can see must not eat the player's first Back press.
  useEffect(
    () =>
      pushBpBack(() => {
        const el = rootRef.current;
        const root = el?.closest<HTMLElement>("[data-bp-root],[data-bp-player-surface]") ?? null;
        if (!el || bpFocusScope(root) !== el) return false;
        if (!bpSurfaceVisible(el)) return false;
        onClose();
        return true;
      }),
    [onClose],
  );

  const surface = play.preselect ? "subtitles" : play.autoBusy ? "auto" : "list";
  // Swapping one full-page surface for another leaves the ring on a node that no
  // longer exists, and the shell's seeding pass has usually expired by then.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => recoverBpFocus());
    return () => window.cancelAnimationFrame(raf);
  }, [surface]);

  // Measured on a Stick 4K Max with 1017 sources: every arrow press blocked the
  // main thread for 1.1 to 1.6 seconds. bp-focus-core's revealBpRows unskips
  // EVERY data-bp-row in scope on every move, and BpSourceCell makes one per
  // source, so a press forced layout across 23,187 elements and then paid for it
  // again on the revert. Timed directly: 331ms to lay out, 535ms to revert.
  //
  // Only three rows are ever on screen. Mounting the rest is what costs, so the
  // list grows as it is scrolled rather than arriving whole. The lead is
  // deliberately enormous: a row is about 199px and a Down press scrolls one, so
  // the shared 100px observer in lib/visibility would extend the list AFTER the
  // press that needed it and drop the input.
  const [shown, setShown] = useState(STREAM_PAGE);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const list = useMemo(() => {
    if (mode !== "switch" || !currentUrl) return s.streams;
    const at = s.streams.findIndex((x) =>
      isCurrentStream(x, currentUrl, currentInfoHash, currentFileIdx),
    );
    if (at <= 0) return s.streams;
    const copy = [...s.streams];
    const [cur] = copy.splice(at, 1);
    return [cur, ...copy];
  }, [s.streams, mode, currentUrl, currentInfoHash, currentFileIdx]);

  useEffect(() => {
    setShown(STREAM_PAGE);
  }, [list]);

  // Keyed on list.length alone, never on shown. Re-arming per page mounted the
  // whole list with no input: a fresh IntersectionObserver reports its first
  // entry immediately, React had not laid out the 60 rows just added, so the
  // sentinel still measured close, which advanced shown, which rebuilt the
  // observer. Seventeen rounds later all 1017 sources were in the DOM, 23,187
  // nodes, and the page stopped answering the remote for 25 seconds.
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const totalRef = useRef(list.length);
  totalRef.current = list.length;
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (shownRef.current >= totalRef.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => Math.min(totalRef.current, n + STREAM_PAGE));
        }
      },
      { root: el.closest("[data-bp-scroll-y]"), rootMargin: STREAM_LEAD },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  const heading = episode
    ? `${meta.name} · S${episode.imdbSeason ?? episode.season}E${episode.imdbEpisode ?? episode.episode}`
    : meta.name;
  const debridError = s.result?.debridErrors?.[0];

  if (play.preselect) {
    return (
      <div ref={modalRef} className="absolute inset-0 z-[60]">
        <BpSubtitleStep
          src={play.preselect}
          onStart={play.startPreselect}
          onCancel={play.cancelPreselect}
        />
      </div>
    );
  }

  if (play.autoBusy) {
    return (
      <div ref={modalRef} className="absolute inset-0 z-[60]">
        <BpAutoStep
          meta={meta}
          episode={episode}
          attemptIdx={play.autoAttemptIdx}
          onCancel={play.cancelAuto}
        />
      </div>
    );
  }

  const panel = (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={download ? t("Download") : switching ? t("Switch source") : t("Sources")}
      data-bp-dialog
      style={switching ? SWITCH_GUTTER : undefined}
      className={switching ? SWITCH_SURFACE : PAGE_SURFACE}
    >
      <header className="flex flex-col gap-[clamp(3px,0.4vh,7px)] px-[var(--bp-gutter)] pt-[calc(clamp(26px,3.4vh,52px)_+_var(--bp-safe-y,0px))]">
        <h2 className="font-display text-[clamp(20px,2.9vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {download ? t("Download") : switching ? t("Switch source") : t("Sources")}
        </h2>
        <p className="line-clamp-1 text-[clamp(13px,1.75vh,20px)] font-medium text-ink-subtle">
          {heading}
          {" · "}
          {s.loading
            ? t("Searching")
            : t("{shown} of {total} sources", {
                shown:
                  (showOnline ? list.length : 0) +
                  (showLocal ? localFiles.length : 0) +
                  (showHomeServers ? homeServerCopies.length : 0),
                total:
                  (showOnline ? s.total : 0) +
                  (showLocal ? localFiles.length : 0) +
                  (showHomeServers ? homeServerCopies.length : 0),
              })}
          {s.pendingAddonCount > 0 && ` · ${t("{n} addons loading", { n: s.pendingAddonCount })}`}
        </p>
      </header>

      <BpStreamChips s={s} sourceKind={sourceKind} onSourceKind={setSourceKind} onClose={onClose} />

      {play.error && <BpStreamsBanner text={translatePickerError(t, play.error)} tone="error" />}
      {homeServerError && !play.error && <BpStreamsBanner text={homeServerError} tone="error" />}
      {s.error && !play.error && (
        <BpStreamsBanner text={translatePipelineErrorTransport(t, s.error)} tone="error" />
      )}
      {debridError && (
        <BpStreamsBanner
          text={translateDebridBannerTitle(t, debridBanner(debridError))}
          tone="info"
        />
      )}
      {s.filterFellBack && s.activeFilterId != null && (
        <BpStreamsBanner
          text={t("No sources match your filter. Showing all sources.")}
          tone="info"
        />
      )}

      <div
        data-bp-scroll-y
        data-bp-center
        className={`mt-[clamp(10px,1.2vh,18px)] flex min-h-0 flex-1 flex-col gap-[clamp(9px,1vh,15px)] overflow-y-auto px-[var(--bp-gutter)] pt-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          switching
            ? "pb-[clamp(26px,3vh,44px)]"
            : "pb-[calc(var(--bp-hint-h,0px)_+_clamp(20px,2.4vh,36px))]"
        }`}
      >
        {showLocal &&
          localFiles.map((entry, i) => (
            <BpSourceCell key={entry.id}>
              <BpLocalRow
                entry={entry}
                autofocus={i === 0}
                onPick={() => play.openLocal(localPlayerSrc(entry, s.isAnime, episode))}
              />
            </BpSourceCell>
          ))}
        {showHomeServers &&
          homeServerCopies.map((copy, i) => {
            const connection = s.homeServerConnections.find(
              (entry) => entry.id === copy.connectionId,
            );
            if (!connection) return null;
            const status = homeServerHealth[connection.id] ?? "checking";
            return (
              <BpSourceCell key={copy.key}>
                <BpHomeServerRow
                  copy={copy}
                  connection={connection}
                  status={status}
                  unavailable={status !== "active"}
                  autofocus={(!showLocal || localFiles.length === 0) && i === 0}
                  onPick={() => void playHomeServer(copy)}
                />
              </BpSourceCell>
            );
          })}
        {showOnline &&
          list.slice(0, shown).map((stream, i) => (
            <BpSourceCell key={streamIdentity(stream)}>
              <BpStreamRow
                stream={stream}
                logo={s.addonLogo(stream)}
                cached={anyStreamCached(stream) || s.cachedOn(stream) != null}
                cachedOn={s.cachedOn(stream)}
                isAnime={s.isAnime}
                isCurrent={
                  currentUrl != null &&
                  isCurrentStream(stream, currentUrl, currentInfoHash, currentFileIdx)
                }
                remembered={s.rememberedStream != null && s.rememberedStream === stream}
                resolving={play.resolvingKey === streamIdentity(stream)}
                failed={play.failed(stream)}
                hostMatch={s.hostMatchFor(stream)}
                showName={meta.name}
                episode={episode}
                autofocus={
                  i === 0 &&
                  (!showLocal || localFiles.length === 0) &&
                  (!showHomeServers || homeServerCopies.length === 0)
                }
                download={download}
                onPick={() => play.play(stream)}
              />
            </BpSourceCell>
          ))}
        <div ref={moreRef} aria-hidden className="h-px w-full shrink-0" />
        {(!showOnline || list.length === 0) &&
          (!showLocal || localFiles.length === 0) &&
          (!showHomeServers || homeServerCopies.length === 0) && (
            <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(10px,1.2vh,18px)] text-ink-subtle">
              {s.loading ? (
                <Loader2
                  size={34}
                  className="animate-spin motion-reduce:[animation-duration:2.4s]"
                  strokeWidth={2}
                />
              ) : (
                <PackageX size={34} strokeWidth={1.8} />
              )}
              <p className="text-[clamp(14px,1.95vh,22px)] font-semibold">
                {s.loading
                  ? t("Looking for sources")
                  : s.total > 0
                    ? t("No sources match these filters")
                    : t("No sources found")}
              </p>
              {!s.loading && s.total === 0 && s.canLoosen && (
                <div
                  data-bp-row
                  data-bp-scroll-x
                  style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 100px" }}
                  className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {s.strictMode && (
                    <BpLadderButton label={t("Search wider")} onPress={s.searchWider} />
                  )}
                  {!s.forceShowAll && (
                    <BpLadderButton label={t("Show everything")} onPress={s.showEverything} />
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      {switching && (
        <p className="shrink-0 border-t border-[var(--bp-edge)] px-[var(--bp-gutter)] py-[clamp(11px,1.4vh,20px)] text-[clamp(12.5px,1.7vh,19px)] font-semibold text-ink-subtle">
          {t("Pick a source to swap in place. Playback keeps running.")}
        </p>
      )}

      {play.p2pConfirm && (
        <BpP2pDialog
          stream={play.p2pConfirm}
          onConfirm={play.confirmP2p}
          onCancel={play.cancelP2p}
        />
      )}
      {play.debridDown && (
        <BpDebridDownDialog onTryAgain={play.dismissDebridDown} onBack={onClose} />
      )}
      {s.noSources && localFiles.length === 0 && homeServerCopies.length === 0 && (
        <BpNoSourcesDialog title={meta.name} onClose={onClose} />
      )}
      {play.autoExhausted && !s.noSources && !play.debridDown && (
        <BpAutoExhaustedDialog
          title={meta.name}
          episode={episode}
          triedCount={play.autoTriedCount}
          onBrowse={play.browseManually}
          onBack={onClose}
        />
      )}
    </div>
  );

  if (!switching) return panel;

  // The card clips its own overflow, and the dialogs above are absolute against
  // this scrim rather than the card, so their containing block sits outside the
  // clip and they still cover the whole layer.
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_50%,transparent)] p-[clamp(14px,2.4vh,40px)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {panel}
    </div>
  );
}
