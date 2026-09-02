import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, RotateCcw, X } from "lucide-react";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { useMedia } from "@/components/hover-preview/scene";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { isLocalUrl } from "@/lib/player/local-url";
import { getPlaybackPosition, usePlaybackFlag } from "@/lib/player/playback-clock";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { useTitleLogo } from "@/lib/title-logo";
import type { EngineStats } from "@/lib/torrent/engine-stats";
import type { PlayerSrc } from "@/lib/view";
import { bpCardArt } from "../bp-art";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { bpOverscan } from "../bp-safe-area";
import { ensureBigPictureTokens } from "../bp-tokens";
import { currentBpFocus, setBpFocus, type BpDir } from "../use-bp-focus";
import { BpP2pReadout, bpStageLabel, formatBpBytes, useBpP2pStatus } from "./bp-p2p-status";

const FADE_MS = 320;
const STILL_LOOKING_MS = 22_000;
const HEAVY_BYTES = 20 * 1024 ** 3;
const BLURRED_ART_W = 240;

const ACTION =
  "flex h-[clamp(48px,5.6vh,66px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-md)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold";
const ACTION_QUIET = `${ACTION} border border-[var(--bp-edge-2)] text-ink`;
const ACTION_LOUD = `${ACTION} bg-[var(--bp-on)] text-ink`;

function BpConnectMark({ logo, title }: { logo: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <h1 className="font-display text-[clamp(30px,5.4vh,78px)] font-semibold leading-[1.02] tracking-[-0.025em] text-ink [text-wrap:balance]">
        {title}
      </h1>
    );
  }
  return (
    <img
      src={logo}
      alt={title}
      draggable={false}
      onError={() => setFailed(true)}
      className="max-h-[clamp(78px,17vh,238px)] w-auto max-w-[min(100%,720px)] object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.62)]"
    />
  );
}

function episodeLine(src: PlayerSrc): string | null {
  const ep = src.episode;
  if (!ep) return null;
  const season = ep.imdbSeason ?? ep.season;
  const number = String(ep.imdbEpisode ?? ep.episode).padStart(2, "0");
  return [`S${season}`, `E${number}`, ep.name].filter(Boolean).join(" · ");
}

export function BpConnecting({
  src,
  snap,
  forceShow,
  failed,
  engineStats = null,
  onCancel,
  onRetry,
  onShowingChange,
}: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  forceShow?: boolean;
  failed?: boolean;
  engineStats?: EngineStats | null;
  onCancel: () => void;
  onRetry?: () => void;
  onShowingChange?: (showing: boolean) => void;
}) {
  const t = useBpT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const { settings } = useSettings();
  const pinnedLogo = useTitleLogo(src.meta.id);
  const logoSlides = useMemo(() => [src.meta], [src.meta]);
  const localizedLogos = useHeroLogos(logoSlides, settings);
  const logo = pinnedLogo ?? localizedLogos[src.meta.id] ?? src.meta.logo ?? null;
  const local = isLocalUrl(src.url);

  useLayoutEffect(() => ensureBigPictureTokens(), []);

  const everPlayedRef = useRef(false);
  const hasProgress = usePlaybackFlag(() => getPlaybackPosition() > 0.3);
  if (hasProgress && (snap.durationSec > 0 || snap.status === "playing")) {
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
    const timer = window.setTimeout(() => setMounted(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [showing]);

  const streamBytes = src.streamRef?.size ?? engineStats?.streamLen ?? null;
  const status = useBpP2pStatus({
    url: src.url,
    infoHash: src.streamRef?.infoHash ?? null,
    fileIdx: src.streamRef?.fileIdx ?? null,
    active: showing,
    stats: engineStats,
    streamBytes,
  });
  const terminal = status.torrent && status.phase === "no-peers";

  const cancel = useCallback(() => {
    SFX.close();
    onCancel();
  }, [onCancel]);

  const retry = status.retry;
  const tryAgain = useCallback(() => {
    SFX.click();
    retry();
    onRetry?.();
  }, [retry, onRetry]);

  useEffect(() => {
    if (!showing) return;
    return pushBpBack(() => {
      onCancel();
      return true;
    });
  }, [showing, onCancel]);

  const step = useCallback((dir: BpDir): boolean => {
    const root = rootRef.current;
    if (!root) return false;
    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-bp-focusable]"));
    if (cells.length === 0) return false;
    if (dir === "up" || dir === "down") return true;
    const rtl = getComputedStyle(root).direction === "rtl";
    const forward = rtl ? dir === "left" : dir === "right";
    const at = cells.findIndex((el) => el.dataset.bpFocus === "true");
    const want = at < 0 ? 0 : at + (forward ? 1 : -1);
    const next = cells[Math.min(cells.length - 1, Math.max(0, want))];
    if (next && next !== cells[at]) setBpFocus(next, { dir });
    return true;
  }, []);

  // The one listener on this surface, and it is allowed to be the only one:
  // the root below carries data-bp-overlay while showing, and bpOverlayOpen()
  // is the first guard in both useBpFocusRoot and useBpPlayerIdleKeys, so the
  // shell stands its own listener down while this is up. Registering through
  // setBpPlayerKeyHandler instead would be dead code for exactly the same
  // reason: the only caller of bpPlayerHandledKey is behind that same guard.
  // stopImmediatePropagation, never stopPropagation: the player's seek keys are
  // a sibling listener on window, and only the immediate form stops those.
  useEffect(() => {
    if (!showing) return;
    const dirs: Record<string, BpDir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = dirs[e.key];
      if (dir) {
        e.preventDefault();
        e.stopImmediatePropagation();
        step(dir);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const el = currentBpFocus(rootRef.current);
        if (el) {
          SFX.click();
          el.click();
        }
        return;
      }
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showing, step, cancel]);

  // No ring restore on unmount. It cannot work: applyBpFocus refuses inside the
  // shell root while playback holds visibility:hidden on it, and the seed below
  // has already cleared the old mark document-wide by then. The shell reseeds
  // itself from data-bp-restore-key when its own key listener comes back.
  const slow = status.torrent && status.phase === "slow";
  // mounted, not showing: on a retry the portal is not in the DOM on the render
  // that flips showing, so a seed keyed on showing alone runs against a null ref
  // and never runs again.
  useEffect(() => {
    if (!mounted) return;
    const root = rootRef.current;
    if (!root) return;
    const marked = currentBpFocus(root);
    if (marked?.isConnected && root.contains(marked)) return;
    const first = root.querySelector<HTMLElement>("[data-bp-focusable]");
    if (first) setBpFocus(first, { silent: true });
  }, [mounted, showing, terminal, slow]);

  const heavy = status.torrent && streamBytes != null && streamBytes > HEAVY_BYTES;
  const note = useMemo(() => {
    if (terminal) {
      return t(
        "Couldn't connect to any peers for this torrent. It may be unreachable on your network (some ISPs and VPNs block torrent traffic).",
      );
    }
    if (slow) return t("Found peers but no data yet. The torrent may be slow.");
    if (snap.buffering)
      return t("The player has the stream open and is waiting on the next piece.");
    if (status.torrent && status.peers === 0 && status.elapsedMs >= STILL_LOOKING_MS) {
      return t("Still looking. Some torrents take a minute to find their first peer.");
    }
    if (status.torrent && status.peers > 0) {
      return t(
        "Downloading the start of the file. Playback begins once there is enough to keep going.",
      );
    }
    return null;
  }, [t, terminal, slow, snap.buffering, status.torrent, status.peers, status.elapsedMs]);

  // Its own line, never folded into the note chain. A file this large buffers
  // constantly, so anything behind snap.buffering is suppressed exactly when it
  // is the thing worth reading.
  const heavyNote =
    heavy && !terminal
      ? t(
          "Heads up: this is a large file for peer-to-peer streaming, so it can take a while to start. A 1080p source or a debrid service will load faster.",
        )
      : null;

  if (!mounted) return null;

  const art = bpCardArt(
    src.episode?.still || src.meta.background || src.meta.poster || undefined,
    BLURRED_ART_W,
  );
  const title = src.meta.name ?? src.title;
  const episode = episodeLine(src);
  const quality = src.streamRef?.resolution || src.streamRef?.quality || null;
  const source = [quality, streamBytes ? formatBpBytes(streamBytes) : null]
    .filter(Boolean)
    .join(" · ");
  const label = bpStageLabel(status, snap.buffering, local, t);
  const overscan = bpOverscan();
  const actions = terminal
    ? [
        {
          key: "back",
          label: t("Go back"),
          icon: <ArrowLeft size={20} strokeWidth={2.4} />,
          loud: true,
          run: cancel,
        },
        {
          key: "retry",
          label: t("Try again"),
          icon: <RotateCcw size={19} strokeWidth={2.4} />,
          loud: false,
          run: tryAgain,
        },
      ]
    : [
        {
          key: "cancel",
          label: t("Cancel"),
          icon: <X size={19} strokeWidth={2.4} />,
          loud: false,
          run: cancel,
        },
        ...(slow
          ? [
              {
                key: "retry",
                label: t("Try again"),
                icon: <RotateCcw size={19} strokeWidth={2.4} />,
                loud: false,
                run: tryAgain,
              },
            ]
          : []),
      ];
  const rootStyle = {
    visibility: "visible",
    pointerEvents: showing ? "auto" : "none",
    ...(overscan > 0 ? { "--bp-overscan": String(overscan) } : null),
  } as CSSProperties;

  return createPortal(
    // A second [data-bp-root] on purpose. Every --bp-* token is scoped to that
    // attribute, and the shell's own root is visibility:hidden the moment
    // playback opens, which also makes everything under it unfocusable. This
    // surface must outlive that, so it carries the scope itself.
    <div
      ref={rootRef}
      data-bp-root
      data-bp-connect
      data-bp-overlay={showing ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 z-[940] overflow-hidden bg-[var(--bp-void)] text-ink transition-opacity duration-300 motion-reduce:transition-none ${
        showing ? "opacity-100" : "opacity-0"
      }`}
      style={rootStyle}
    >
      {/* The bleed lives on the wrapper because the drift animates transform on
          the image, which would otherwise replace the scale that hides the
          blurred edges and let them walk into frame. */}
      {art && (
        <div className="absolute inset-0 scale-[1.07]">
          <img
            src={art}
            alt=""
            aria-hidden
            draggable={false}
            className="h-full w-full object-cover opacity-55 blur-[9px]"
            style={
              reduce || terminal || slow || !showing
                ? undefined
                : { animation: "bp-kenburns 34s ease-in-out infinite" }
            }
          />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-side)" }} />
      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-up)" }} />

      <div className="absolute inset-0 flex flex-col justify-end px-[var(--bp-gutter)] pb-[calc(clamp(38px,6vh,96px)_+_var(--bp-safe-y,0px))]">
        <div className="flex w-[min(100%,clamp(440px,54vw,1080px))] flex-col gap-[clamp(13px,1.8vh,30px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_120ms_backwards] motion-reduce:[animation:none]">
          <BpConnectMark logo={logo} title={title} />

          {(episode || source) && (
            <p className="line-clamp-1 text-[clamp(13px,1.75vh,20px)] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {[episode, source].filter(Boolean).join("  ·  ")}
            </p>
          )}

          {!terminal && (
            <BpP2pReadout
              key={`${src.url}:${status.attempt}`}
              status={status}
              label={label}
              note={note}
              done={done}
              reduce={reduce}
            />
          )}

          {heavyNote && (
            <p className="max-w-[46ch] text-[clamp(13px,1.75vh,20px)] font-medium leading-snug text-ink-subtle opacity-80">
              {heavyNote}
            </p>
          )}

          {terminal && (
            <div className="flex flex-col gap-[clamp(7px,0.9vh,14px)]">
              <p
                role="status"
                className="text-[clamp(12.5px,1.65vh,19px)] font-bold uppercase tracking-[0.17em] text-ink"
              >
                {label}
              </p>
              <p className="max-w-[46ch] text-[clamp(14px,1.95vh,23px)] font-medium leading-snug text-ink-subtle">
                {note}
              </p>
            </div>
          )}

          {/* Resting fill stays in classes. The chip focus rule in bp-tokens sets
              background without !important, so an inline fill here would outrank
              it and the D-pad cursor would never light the button. */}
          <div className="flex flex-wrap items-center gap-[clamp(10px,1vw,20px)] pt-[clamp(3px,0.5vh,9px)]">
            {actions.map((a, at) => (
              <button
                key={a.key}
                type="button"
                data-bp-focusable
                data-bp-chip
                data-bp-autofocus={at === 0 ? "true" : undefined}
                onClick={a.run}
                className={a.loud ? ACTION_LOUD : ACTION_QUIET}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
