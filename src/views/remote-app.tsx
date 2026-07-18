import {
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Minus,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { CastIcon } from "@/components/player/cast-icon";
import { HarborLoader } from "@/components/harbor-loader";
import { HarborMark } from "@/components/icons/harbor-mark";
import type { CastDeviceInfo } from "@/lib/cast";
import { useKeyboardNavigation } from "@/lib/keyboard-navigation";
import { useRemoteClient } from "@/lib/remote/use-remote-client";
import type {
  RemoteCastDevice,
  RemoteNavKey,
  RemoteSnapshot,
  RemoteTextEntry,
} from "@/lib/remote/protocol";

function toCastDevice(d: RemoteCastDevice): CastDeviceInfo {
  return {
    id: d.id,
    name: d.name,
    host: d.host,
    port: d.port,
    model: d.model ?? null,
    kind: d.kind,
    control_url: d.controlUrl ?? null,
    audio_only: d.audioOnly ?? false,
  };
}

function sourceLine(snapshot: RemoteSnapshot): string | null {
  const src = snapshot.source;
  if (!src) return null;
  // `quality` already includes resolution (see formatStreamQuality) — don't repeat it.
  const bits: string[] = [];
  if (src.quality) bits.push(src.quality);
  else if (src.resolution) bits.push(src.resolution);
  if (src.releaseGroup) bits.push(src.releaseGroup);
  if (bits.length) return bits.join(" · ");

  const label = src.label?.trim();
  if (!label) return null;
  const title = snapshot.mediaTitle?.trim();
  if (!title) return label;
  if (label.toLowerCase() === title.toLowerCase()) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const nt = norm(title);
  const nl = norm(label);
  if (nt && nl && (nl.startsWith(nt) || nt.startsWith(nl))) return null;
  return label;
}

function CircleBtn({
  label,
  disabled,
  onClick,
  children,
  size = "md",
  initialFocus,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  initialFocus?: boolean;
}) {
  const dim =
    size === "sm"
      ? "h-11 w-11"
      : size === "md"
        ? "h-16 w-16"
        : size === "lg"
          ? "h-[4.75rem] w-[4.75rem]"
          : "h-24 w-24";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-tv-initial-focus={initialFocus || undefined}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors active:bg-white/[0.14] disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

function SeekTen({
  forward,
  disabled,
  onClick,
}: {
  forward?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <CircleBtn
      label={forward ? "Seek forward 10 seconds" : "Seek back 10 seconds"}
      disabled={disabled}
      onClick={onClick}
      size="lg"
    >
      <span className="relative flex h-9 w-9 items-center justify-center">
        <RotateCcw size={34} strokeWidth={1.5} className={forward ? "scale-x-[-1]" : undefined} />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-tight">
          10
        </span>
      </span>
    </CircleBtn>
  );
}

const SWIPE_STEP_PX = 56;
const TAP_SLOP_PX = 16;
/** Wait before leaving Now Playing so brief idle flashes (episode hop / sticky) don't thrash the UI. */
const LEAVE_NOW_PLAYING_MS = 120;

type RemoteSurfaceMode = "browse" | "nowPlaying";

/** Enter Now Playing immediately; leave only after idle has settled. */
function useRemoteSurfaceMode(idle: boolean): RemoteSurfaceMode {
  const [mode, setMode] = useState<RemoteSurfaceMode>(() => (idle ? "browse" : "nowPlaying"));

  useEffect(() => {
    if (!idle) {
      setMode("nowPlaying");
      return;
    }
    const t = window.setTimeout(() => setMode("browse"), LEAVE_NOW_PLAYING_MS);
    return () => window.clearTimeout(t);
  }, [idle]);

  return mode;
}

/** Apple TV–style touch surface: swipe moves host focus, tap selects. */
function TouchpadSurface({
  onNav,
  className,
  children,
  ariaLabel = "Touchpad. Swipe to move, tap to select.",
}: {
  onNav: (key: RemoteNavKey) => void;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
}) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const lastStepRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastSwipeTimeRef = useRef<number>(0);

  const fireDir = useCallback(
    (dx: number, dy: number) => {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const key: RemoteNavKey = horizontal ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      lastSwipeTimeRef.current = Date.now();
      onNav(key);
    },
    [onNav],
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (pointerIdRef.current != null) return;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    originRef.current = { x: e.clientX, y: e.clientY };
    lastStepRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId || !lastStepRef.current || !originRef.current) return;
    const dx = e.clientX - lastStepRef.current.x;
    const dy = e.clientY - lastStepRef.current.y;
    const fromOrigin = Math.hypot(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
    if (fromOrigin > TAP_SLOP_PX) movedRef.current = true;

    if (Math.hypot(dx, dy) < SWIPE_STEP_PX) return;
    fireDir(dx, dy);
    lastStepRef.current = { x: e.clientX, y: e.clientY };
  };

  const endPointer = (e: ReactPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!movedRef.current) {
      const timeSinceSwipe = Date.now() - lastSwipeTimeRef.current;
      if (timeSinceSwipe > 200) {
        onNav("select");
      }
    }
    pointerIdRef.current = null;
    originRef.current = null;
    lastStepRef.current = null;
    movedRef.current = false;
  };

  return (
    <div
      role="application"
      aria-label={ariaLabel}
      className={`relative touch-none select-none overflow-hidden ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {children}
    </div>
  );
}

/** Full-screen text entry when the host has a text field focused. */
function FullscreenTextEntry({
  entry,
  inputRef,
  onChange,
  onSubmit,
  onDismiss,
}: {
  entry: RemoteTextEntry;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  /** Flush value + submit on the host, then dismiss. */
  onSubmit: (value: string) => void;
  /** Close the overlay without submitting (does not send host Back). */
  onDismiss: () => void;
}) {
  const [value, setValue] = useState(entry.value);
  const focusedRef = useRef(false);
  const didAutofocus = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setValue(entry.value);
  }, [entry.value]);

  // Autofocus once when the overlay opens — don't re-run or buttons can't be tapped.
  useEffect(() => {
    if (didAutofocus.current) return;
    didAutofocus.current = true;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [inputRef]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-remote-text-entry
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4">
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-11 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] active:bg-white/[0.14]"
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
          Done
        </button>
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="flex h-11 items-center rounded-full bg-white/[0.12] px-5 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] active:bg-white/[0.18]"
        >
          Go
        </button>
      </div>

      <textarea
        ref={inputRef}
        value={value}
        placeholder={entry.placeholder || undefined}
        inputMode="text"
        enterKeyHint="done"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        rows={1}
        aria-label="Type into the focused field on the display"
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        className="min-h-0 w-full flex-1 resize-none bg-transparent px-5 py-6 font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-tight tracking-tight text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  );
}

function RendererSheet({
  snapshot,
  open,
  onClose,
  onPickLocal,
  onPickCast,
  onRefresh,
}: {
  snapshot: RemoteSnapshot;
  open: boolean;
  onClose: () => void;
  onPickLocal: () => void;
  onPickCast: (id: string) => void;
  onRefresh: () => void;
}) {
  if (!open) return null;
  const activeId = snapshot.target.kind === "cast" ? snapshot.target.deviceId : "local";
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-canvas/70 backdrop-blur-sm"
      data-remote-sheet
    >
      <div className="flex-1" role="presentation" onClick={onClose} />
      <div className="rounded-t-2xl border border-edge-soft bg-surface px-4 pb-8 pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-edge" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink">Select renderer</h2>
          <button
            type="button"
            onClick={onRefresh}
            disabled={snapshot.castDiscovering}
            className="rounded-lg border border-edge px-2.5 py-1.5 text-[12px] text-ink-muted hover:bg-elevated hover:text-ink disabled:cursor-default disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-1.5">
              {snapshot.castDiscovering && (
                <Loader2 size={12} strokeWidth={2.2} className="animate-spin" />
              )}
              {snapshot.castDiscovering ? "Scanning..." : "Refresh"}
            </span>
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          <li>
            <button
              type="button"
              onClick={onPickLocal}
              data-tv-initial-focus
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${
                activeId === "local" ? "bg-accent-soft text-ink" : "hover:bg-elevated text-ink"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-elevated">
                <Monitor size={22} strokeWidth={1.6} className="text-ink" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[16px] font-medium">This PC</span>
                <span className="text-[12px] text-ink-muted">Harbor on the server display</span>
              </span>
            </button>
          </li>
          {snapshot.castDevices.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onPickCast(d.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${
                  activeId === d.id ? "bg-accent-soft text-ink" : "hover:bg-elevated text-ink"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-elevated p-1.5">
                  <CastIcon device={toCastDevice(d)} size={36} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-medium">{d.name}</span>
                  <span className="text-[12px] text-ink-muted">{d.model || d.kind}</span>
                </span>
              </button>
            </li>
          ))}
          {snapshot.castDevices.length === 0 && (
            <li className="px-3 py-4 text-[13px] text-ink-muted">
              {snapshot.castDiscovering
                ? "Scanning your network..."
                : "No Chromecast, DLNA, or Roku devices found. Make sure your TV is on, awake, and on the same Wi-Fi."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function RemoteBody({
  snapshot,
  onToggle,
  onSeekBy,
  onVolumeStep,
  onMute,
  onPrevEpisode,
  onNextEpisode,
  onBack,
  onOpenRenderers,
  onOpenSearch,
  onNav,
  onSetText,
  onSubmitText,
  onBlurText,
}: {
  snapshot: RemoteSnapshot;
  onToggle: () => void;
  onSeekBy: (delta: number) => void;
  onVolumeStep: (delta: number) => void;
  onMute: () => void;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  onBack: () => void;
  onOpenRenderers: () => void;
  onOpenSearch: () => void;
  onNav: (key: RemoteNavKey) => void;
  onSetText: (value: string) => void;
  onSubmitText: (value: string) => void;
  onBlurText: () => void;
}) {
  const mode = useRemoteSurfaceMode(snapshot.idle);
  const browsing = mode === "browse";
  const heldSnap = useRef(snapshot);
  if (!snapshot.idle) heldSnap.current = snapshot;
  // While leaving Now Playing, keep last media on screen until browse mode settles.
  const view = browsing || !snapshot.idle ? snapshot : heldSnap.current;
  const textEntry = snapshot.textEntry;
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [typing, setTyping] = useState(false);
  const [textDismissed, setTextDismissed] = useState(false);
  const textEntryActive = !!textEntry;
  const heldTextEntry = useRef(textEntry);
  if (textEntry) heldTextEntry.current = textEntry;
  const setTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const episodeLine = useMemo(() => {
    if (!view.episode) return null;
    const ep = `S${view.episode.season} · E${view.episode.episode}`;
    const epName = view.episode.name?.trim();
    return epName ? `${ep}  ${epName}` : ep;
  }, [view.episode]);
  const source = sourceLine(view);
  const activeCast = useMemo(() => {
    if (snapshot.target.kind !== "cast") return null;
    const id = snapshot.target.deviceId;
    return snapshot.castDevices.find((d) => d.id === id) ?? null;
  }, [snapshot.target, snapshot.castDevices]);
  const title = view.mediaTitle || "Unknown title";
  const showEpisodeNav = !!view.episode;

  useEffect(() => {
    if (browsing || textEntryActive || typing) return;
    const play = document.querySelector<HTMLElement>(
      "[data-remote-transport] [data-tv-initial-focus]",
    );
    play?.focus({ preventScroll: true });
  }, [browsing, textEntryActive, typing]);

  useEffect(() => {
    return () => {
      if (setTextTimer.current) clearTimeout(setTextTimer.current);
    };
  }, []);

  // Open fullscreen whenever the host arms a text field (search on focus, others on tap).
  useEffect(() => {
    if (textEntryActive) {
      if (!textDismissed) setTyping(true);
      return;
    }
    setTextDismissed(false);
    // Media active → drop text UI immediately so Now Playing can show (e.g. Open from search).
    if (!snapshot.idle) {
      setTyping(false);
      return;
    }
    // Idle: brief grace so focus moving between inputs doesn't flash the overlay away.
    const t = window.setTimeout(() => setTyping(false), 100);
    return () => window.clearTimeout(t);
  }, [textEntryActive, textDismissed, snapshot.idle]);

  const pushText = useCallback(
    (value: string) => {
      if (setTextTimer.current) clearTimeout(setTextTimer.current);
      setTextTimer.current = setTimeout(() => onSetText(value), 40);
    },
    [onSetText],
  );

  const dismissTextEntry = useCallback(() => {
    if (setTextTimer.current) clearTimeout(setTextTimer.current);
    setTextDismissed(true);
    setTyping(false);
    textInputRef.current?.blur();
    // Disarm on the host without blurring so HTPC focus stays put.
    onBlurText();
  }, [onBlurText]);

  const submitTextEntry = useCallback(
    (value: string) => {
      if (setTextTimer.current) clearTimeout(setTextTimer.current);
      onSubmitText(value);
      setTextDismissed(true);
      setTyping(false);
      textInputRef.current?.blur();
    },
    [onSubmitText],
  );

  const showTextOverlay = !textDismissed && (textEntryActive || typing) && !!heldTextEntry.current;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2.2vh,1.25rem)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      {showTextOverlay && heldTextEntry.current ? (
        <FullscreenTextEntry
          entry={heldTextEntry.current}
          inputRef={textInputRef}
          onChange={pushText}
          onSubmit={submitTextEntry}
          onDismiss={dismissTextEntry}
        />
      ) : null}

      {/* Top chrome: logo · device · mute */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to home"
          onClick={onBack}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/[0.08] px-3 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] active:bg-white/[0.14]"
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
          <HarborMark className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onOpenRenderers}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated">
            {activeCast ? (
              <CastIcon device={toCastDevice(activeCast)} size={26} />
            ) : (
              <Monitor size={15} strokeWidth={1.7} />
            )}
          </span>
          <span className="truncate text-[15px] font-medium text-ink">{snapshot.target.label}</span>
          <ChevronDown size={16} strokeWidth={1.8} className="shrink-0 text-ink-muted" />
        </button>

        {browsing ? (
          <CircleBtn label="Search on display" onClick={onOpenSearch} size="sm">
            <Search size={18} strokeWidth={1.7} />
          </CircleBtn>
        ) : (
          <CircleBtn label={snapshot.muted ? "Unmute" : "Mute"} onClick={onMute} size="sm">
            {snapshot.muted || snapshot.volume === 0 ? (
              <VolumeX size={18} strokeWidth={1.7} />
            ) : (
              <Volume2 size={18} strokeWidth={1.7} />
            )}
          </CircleBtn>
        )}
      </div>

      {/* One touchpad for both modes — poster is the surface while playing */}
      <TouchpadSurface
        onNav={onNav}
        ariaLabel={
          browsing
            ? "Touchpad. Swipe to move, tap to select."
            : "Now playing touchpad. Swipe to move focus on the display, tap to select."
        }
        className={
          browsing
            ? "min-h-0 flex-1 rounded-[1.75rem] bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] active:bg-white/[0.09]"
            : "min-h-0 flex-1 rounded-[1.35rem] bg-elevated shadow-lg"
        }
      >
        {!browsing ? (
          <>
            {view.posterUrl ? (
              <img
                src={view.posterUrl}
                alt=""
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-ink-subtle">
                <Monitor size={44} strokeWidth={1.4} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/75" />

            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex min-w-0 items-end gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="line-clamp-2 break-words font-display text-[clamp(1.6rem,6vw,2rem)] leading-[1.05] tracking-tight text-white">
                  {title}
                </h1>
                {episodeLine ? (
                  <p className="mt-1 line-clamp-2 break-words text-[13.5px] leading-snug text-white/80">
                    {episodeLine}
                  </p>
                ) : source ? (
                  <p className="mt-1 line-clamp-2 break-words text-[13.5px] leading-snug text-white/80">
                    {source}
                  </p>
                ) : null}
              </div>

              {showEpisodeNav ? (
                <div
                  className="pointer-events-auto mb-0.5 flex shrink-0 items-center gap-1"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Previous episode"
                    disabled={!view.hasPrevEpisode}
                    onClick={onPrevEpisode}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                      view.hasPrevEpisode
                        ? "text-white/90 active:bg-white/10"
                        : "cursor-not-allowed text-white/25"
                    }`}
                  >
                    <ChevronsLeft size={22} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next episode"
                    disabled={!view.hasNextEpisode}
                    onClick={onNextEpisode}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                      view.hasNextEpisode
                        ? "text-white/90 active:bg-white/10"
                        : "cursor-not-allowed text-white/25"
                    }`}
                  >
                    <ChevronsRight size={22} strokeWidth={2.2} />
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </TouchpadSurface>

      {browsing ? (
        <button
          type="button"
          aria-label="Back on display"
          onClick={() => onNav("back")}
          className="flex h-16 w-full shrink-0 items-center justify-center gap-2.5 rounded-full bg-white/[0.08] text-[17px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] active:bg-white/[0.14]"
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
      ) : (
        <div
          data-remote-transport
          className="grid w-full grid-cols-[1fr_auto_1fr] grid-rows-[4.75rem_4.75rem] place-items-center gap-4 pb-2"
        >
          <CircleBtn label="Back on display" onClick={() => onNav("back")} size="lg">
            <ChevronLeft size={32} strokeWidth={1.7} />
          </CircleBtn>

          <CircleBtn
            label={view.playing ? "Pause" : "Play"}
            onClick={onToggle}
            size="lg"
            initialFocus
          >
            {view.playing ? (
              <Pause size={36} strokeWidth={1.5} />
            ) : (
              <Play size={36} strokeWidth={1.5} className="translate-x-[2px]" />
            )}
          </CircleBtn>

          <div className="col-start-3 row-span-2 grid w-[4.75rem] grid-rows-[4.75rem_1rem_4.75rem] overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <button
              type="button"
              aria-label="Volume up"
              onClick={() => onVolumeStep(0.1)}
              className="flex items-center justify-center text-ink active:bg-white/[0.1]"
            >
              <Plus size={22} strokeWidth={1.7} />
            </button>
            <div className="flex items-center justify-center">
              <div className="h-px w-8 bg-white/15" />
            </div>
            <button
              type="button"
              aria-label="Volume down"
              onClick={() => onVolumeStep(-0.1)}
              className="flex items-center justify-center text-ink active:bg-white/[0.1]"
            >
              <Minus size={22} strokeWidth={1.7} />
            </button>
          </div>

          <SeekTen onClick={() => onSeekBy(-10)} />
          <SeekTen forward onClick={() => onSeekBy(10)} />
        </div>
      )}
    </div>
  );
}

/** Wait before fullscreen reconnect UI so brief WS blips don't flash. */
const DISCONNECT_OVERLAY_MS = 1200;

export function RemoteApp() {
  const { status, snapshot, sendCommand } = useRemoteClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);
  const [showDisconnected, setShowDisconnected] = useState(false);

  useEffect(() => {
    if (status === "connected") {
      setWasConnected(true);
      setShowDisconnected(false);
      return;
    }
    if (!wasConnected) return;
    const t = window.setTimeout(() => setShowDisconnected(true), DISCONNECT_OVERLAY_MS);
    return () => window.clearTimeout(t);
  }, [status, wasConnected]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const goHome = useCallback(() => {
    window.location.assign("/");
  }, []);

  const onBack = useCallback(() => {
    if (sheetOpen) {
      closeSheet();
      return true;
    }
    // Drive the host display back — don't navigate the phone away from /remote.
    sendCommand({ action: "nav", key: "back" });
    return true;
  }, [sheetOpen, closeSheet, sendCommand]);

  useKeyboardNavigation({ wrap: false, onBack });

  useEffect(() => {
    if (sheetOpen) {
      const first = document.querySelector<HTMLElement>(
        "[data-remote-sheet] [data-tv-initial-focus]",
      );
      first?.focus({ preventScroll: true });
      return;
    }
    const initial = document.querySelector<HTMLElement>("[data-tv-initial-focus]");
    if (initial && document.activeElement === document.body) {
      initial.focus({ preventScroll: true });
    }
  }, [sheetOpen]);

  useEffect(() => {
    const nodes = [document.documentElement, document.body, document.getElementById("root")];
    for (const el of nodes) {
      el?.style.setProperty("overscroll-behavior", "none");
      el?.style.setProperty("overscroll-behavior-y", "none");
    }
    return () => {
      for (const el of nodes) {
        el?.style.removeProperty("overscroll-behavior");
        el?.style.removeProperty("overscroll-behavior-y");
      }
    };
  }, []);

  return (
    <div className="flex h-full min-h-[100dvh] flex-col bg-canvas text-ink">
      {showDisconnected ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-black">
          <HarborLoader size="md" caption="Connecting" />
        </div>
      ) : (
        <>
          <div aria-hidden={sheetOpen || undefined} className="flex min-h-0 flex-1 flex-col">
            <RemoteBody
              snapshot={snapshot}
              onBack={goHome}
              onOpenRenderers={() => {
                sendCommand({ action: "castDiscover" });
                setSheetOpen(true);
              }}
              onOpenSearch={() => sendCommand({ action: "openSearch" })}
              onToggle={() => sendCommand({ action: snapshot.playing ? "pause" : "play" })}
              onSeekBy={(delta) =>
                sendCommand({
                  action: "seek",
                  positionSec: Math.max(0, snapshot.positionSec + delta),
                })
              }
              onVolumeStep={(delta) => {
                const next = Math.max(
                  0,
                  Math.min(1, (snapshot.muted ? 0 : snapshot.volume) + delta),
                );
                sendCommand({ action: "setVolume", volume: next });
                if (next > 0 && snapshot.muted) sendCommand({ action: "setMuted", muted: false });
              }}
              onMute={() => sendCommand({ action: "setMuted", muted: !snapshot.muted })}
              onPrevEpisode={() => sendCommand({ action: "prevEpisode" })}
              onNextEpisode={() => sendCommand({ action: "nextEpisode" })}
              onNav={(key) => sendCommand({ action: "nav", key })}
              onSetText={(value) => sendCommand({ action: "setText", value })}
              onSubmitText={(value) => sendCommand({ action: "submitText", value })}
              onBlurText={() => sendCommand({ action: "blurText" })}
            />
          </div>

          <RendererSheet
            snapshot={snapshot}
            open={sheetOpen}
            onClose={closeSheet}
            onRefresh={() => sendCommand({ action: "castDiscover" })}
            onPickLocal={() => {
              sendCommand({ action: "setTarget", target: "local" });
              setSheetOpen(false);
            }}
            onPickCast={(id) => {
              sendCommand({ action: "setTarget", target: { castDeviceId: id } });
              setSheetOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
