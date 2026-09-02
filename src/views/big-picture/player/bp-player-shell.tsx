import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useView, type PlayerSrc } from "@/lib/view";
import { runBpBack } from "../bp-back";
import { BpHintBar, type BpAction } from "../bp-hint-bar";
import { useBpT } from "../bp-i18n";
import { bpOverscan } from "../bp-safe-area";
import { ensureBigPictureTokens } from "../bp-tokens";
import { useBpFocusRoot } from "../use-bp-focus";
import { BpPlayerProvider, type BpPlayerShellApi } from "./bp-player-context";
import { BpPlayerControls } from "./bp-player-controls";
import { BpPlayerIdentity } from "./bp-player-identity";
import { bpPlayerHandledKey } from "./bp-player-key";
import { BpPlayerRail } from "./bp-player-rail";
import { BpPlayerScrub } from "./bp-player-scrub";
import { bpPanelSlot, bpSlotsIn, collectBpPlayerSlots } from "./bp-player-slots";
import { useBpPlayback } from "./use-bp-playback";
import { useBpPlayerChrome } from "./use-bp-player-chrome";
import { useBpPlayerIdleKeys } from "./use-bp-player-keys";

// No "nav" hint: this surface has no [data-bp-top-bar], so focusBpTopBar can
// only ever return false here. BpHintBar shows it on request, never by default.
const HINTS: BpAction[] = ["select", "back"];

// Clearance between the top of the chrome and anything parked on the stage.
const DOCK_GAP = 14;

// The token sheet gives every [data-bp-root] [data-bp-row] a content-visibility
// of auto with a 340px intrinsic size, sized for a poster row. These three are
// small permanent bars, always on screen, so the skip buys nothing and the
// reserved height would shove the chrome off the bottom the moment one of them
// stops matching :has(:focus). Inline beats the sheet, and revealBpRows leaves
// an already-visible row alone, so the focus engine is unaffected.
const ROW_STYLE: CSSProperties = { contentVisibility: "visible" };

function BpRailRow({
  index,
  rowKey,
  children,
}: {
  index: number;
  rowKey: string;
  children: ReactNode;
}) {
  return (
    <div
      data-bp-rail-row={index}
      data-bp-row
      data-bp-row-key={rowKey}
      style={ROW_STYLE}
      className="relative empty:hidden"
    >
      {children}
    </div>
  );
}

/**
 * The 10-foot player surface.
 *
 * It lives in its own portal on purpose. bp-shell drops visibility:hidden onto
 * [data-bp-root] the instant playback opens, and a hidden element cannot take
 * focus, so anything that has to survive playback must sit outside that tree.
 *
 * Playback itself is untouched: mpv, the bridge and every hook in views/player
 * stay exactly where they are. This is chrome and a focus layer around them,
 * driven through the remote-control hub the phone remote already uses.
 */
export function BpPlayerShell({
  src,
  forcePanel = null,
  children,
}: {
  src: PlayerSrc;
  /**
   * A panel the shell holds open and the rail cannot dismiss. For a blocking
   * fork such as resume-or-start-over: it pins the chrome, hands the panel the
   * D-pad and refuses openPanel, so nothing can be driven behind it. The panel
   * itself owns how it ends, through pushBpBack and its own buttons.
   */
  forcePanel?: string | null;
  children?: ReactNode;
}) {
  const t = useBpT();
  const { exitPlayback } = useView();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(true);
  const [dock, setDock] = useState(0);
  const locked = forcePanel !== null;
  const panel = forcePanel ?? openId;

  const slots = useMemo(() => collectBpPlayerSlots(children), [children]);
  const panels = useMemo(() => bpSlotsIn(slots, "panel"), [slots]);
  const stage = useMemo(() => bpSlotsIn(slots, "stage"), [slots]);
  const top = useMemo(() => bpSlotsIn(slots, "top"), [slots]);
  const transport = useMemo(() => bpSlotsIn(slots, "transport"), [slots]);
  const rail = useMemo(() => bpSlotsIn(slots, "rail"), [slots]);
  const activePanel = useMemo(() => bpPanelSlot(slots, panel), [slots, panel]);

  const playback = useBpPlayback(src, tick);
  const { phase, mounted, wakeChrome, peekChrome, hideChrome, holdChrome } = useBpPlayerChrome({
    playing: playback.playing,
    pinned: panel !== null,
  });

  const up = phase === "up";

  useEffect(() => setTick(phase !== "down"), [phase]);

  useLayoutEffect(() => {
    ensureBigPictureTokens();
  }, []);

  // A panel whose slot went away would pin the chrome open forever with nothing
  // on screen to close. A forced panel is the caller's problem, not the rail's.
  useEffect(() => {
    if (!locked && openId && !activePanel) setOpenId(null);
  }, [locked, openId, activePanel]);

  // The chrome is clamp-sized, so its height is a different number on a 1280x800
  // handheld and a 4K panel. A stage surface parked at a guessed offset lands on
  // the transport at one of them, so the shell measures and publishes the real
  // one and every stage surface reads it as --bp-player-dock.
  useEffect(() => {
    const el = chromeRef.current;
    // phase, not mounted: the chrome stays laid out through its fade, and a
    // stage surface should start dropping with it rather than snap when the
    // element finally unmounts 320ms later.
    if (!mounted || phase === "down" || !el) {
      setDock(0);
      return;
    }
    const measure = () => setDock(Math.round(el.getBoundingClientRect().height) + DOCK_GAP);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, phase, up, activePanel]);

  // Whatever held the ring is about to become inert, and an element that keeps
  // focus while it is inert hands Enter and Space to something invisible.
  useEffect(() => {
    if (phase === "up") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
  }, [phase]);

  const closePanel = useCallback(() => {
    if (locked) return;
    setOpenId(null);
    wakeChrome();
  }, [locked, wakeChrome]);

  const openPanel = useCallback(
    (id: string) => {
      if (locked) return;
      setOpenId(id);
      wakeChrome();
    },
    [locked, wakeChrome],
  );

  const togglePanel = useCallback(
    (id: string) => {
      if (locked) return;
      setOpenId((cur) => (cur === id ? null : id));
      wakeChrome();
    },
    [locked, wakeChrome],
  );

  const onBack = useCallback(() => {
    if (runBpBack()) return;
    // A forced panel already had its say through runBpBack. Falling through to
    // hideChrome would switch the focus engine off and strand it on screen with
    // nothing able to reach its buttons.
    if (locked) return;
    if (panel !== null) {
      closePanel();
      return;
    }
    // Back does not leave playback from here. It puts the chrome away, and the
    // next Back falls through uncaught to the player's own confirm-and-exit.
    hideChrome();
  }, [locked, panel, closePanel, hideChrome]);

  // Through a ref, not the value: playback is a fresh object on every clock
  // tick, and a handler that changes four times a second tears the idle key
  // listener down and rebuilds it four times a second with it.
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const onSelect = useCallback(() => {
    playbackRef.current.playPause();
    wakeChrome();
  }, [wakeChrome]);

  // Exactly one of these is ever live, and an open panel silences both unless
  // it asked the shell to keep driving. Two window listeners acting on arrows
  // is the single most reliable way to make this surface unnavigable.
  useBpFocusRoot({
    rootRef,
    onBack,
    onOptions: wakeChrome,
    // The scrubber steps by time, not geometry, and a source panel steps by its
    // own list. They register through setBpPlayerKeyHandler and the engine asks
    // them before it moves the ring. Without this the registry is only read
    // while the chrome is DOWN, which is exactly when nothing is registered.
    onDir: bpPlayerHandledKey,
    enabled: up && (!activePanel || activePanel.shellNav),
    routeKey: `player:${src.meta.id}:${panel ?? ""}`,
  });

  useBpPlayerIdleKeys({
    enabled: !up && !activePanel,
    onSummon: wakeChrome,
    onPeek: peekChrome,
    onSelect,
    onOptions: wakeChrome,
  });

  const api = useMemo<BpPlayerShellApi>(
    () => ({
      src,
      playback,
      phase,
      chromeUp: phase === "up",
      wakeChrome,
      peekChrome,
      hideChrome,
      holdChrome,
      panel,
      openPanel,
      closePanel,
      togglePanel,
      exit: exitPlayback,
    }),
    [
      src,
      playback,
      phase,
      wakeChrome,
      peekChrome,
      hideChrome,
      holdChrome,
      panel,
      openPanel,
      closePanel,
      togglePanel,
      exitPlayback,
    ],
  );

  const rootStyle = useMemo<CSSProperties>(() => {
    const o = bpOverscan();
    const vars: Record<string, string> = {};
    if (o > 0) vars["--bp-overscan"] = String(o);
    if (dock > 0) vars["--bp-player-dock"] = `${dock}px`;
    return vars as CSSProperties;
  }, [dock]);

  return createPortal(
    <BpPlayerProvider value={api}>
      <div
        ref={rootRef}
        data-bp-root
        data-bp-player-surface
        role="application"
        aria-label={t("Player controls")}
        className="pointer-events-none fixed inset-0 z-[910] text-ink"
        style={rootStyle}
      >
        <div
          inert={activePanel ? true : undefined}
          className="pointer-events-none absolute inset-0 z-30"
        >
          {stage.map((s) => (
            <div key={s.key} className="contents">
              {s.node}
            </div>
          ))}
        </div>

        {mounted && (
          <div
            ref={chromeRef}
            // One surface owns the ring. A panel that renders in place marks
            // itself data-bp-dialog and a portalled one marks data-bp-overlay,
            // but neither is guaranteed, so the chrome steps back either way.
            inert={up && !activePanel ? undefined : true}
            className={`absolute inset-x-0 bottom-0 z-40 isolate transition-opacity duration-[var(--bp-dur)] [transition-timing-function:var(--bp-ease)] motion-reduce:transition-none ${
              phase === "down" ? "opacity-0" : "opacity-100"
            } ${up && !activePanel ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 -z-10 h-[calc(100%_+_clamp(110px,20vh,260px))]"
              style={{ background: "var(--bp-scrim-up)" }}
            />
            <div className="relative flex flex-col gap-[clamp(9px,1.2vh,18px)] pt-[clamp(24px,3.2vh,52px)] pb-[calc(clamp(52px,6.4vh,74px)_+_var(--bp-safe-y,0px))]">
              {up && (
                <div className="px-[var(--bp-gutter)]">
                  {top.length > 0 ? (
                    top.map((s) => <div key={s.key}>{s.node}</div>)
                  ) : (
                    <BpPlayerIdentity playback={playback} />
                  )}
                </div>
              )}

              <div className="flex flex-col gap-[clamp(3px,0.5vh,9px)]">
                <BpRailRow index={0} rowKey="bp-player-scrub">
                  <div className="px-[var(--bp-gutter)]">
                    <BpPlayerScrub playback={playback} active={up} />
                  </div>
                </BpRailRow>

                {up && (
                  <BpRailRow index={1} rowKey="bp-player-transport">
                    <div
                      data-bp-scroll-x
                      className="flex items-center gap-[clamp(10px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] py-[clamp(6px,0.8vh,12px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {transport.length > 0 ? (
                        transport.map((s) => (
                          <div key={s.key} className="contents">
                            {s.node}
                          </div>
                        ))
                      ) : (
                        <BpPlayerControls playback={playback} />
                      )}
                    </div>
                  </BpRailRow>
                )}

                {up && (
                  <BpRailRow index={2} rowKey="bp-player-rail">
                    {rail.length > 0 ? (
                      <div
                        data-bp-scroll-x
                        className="flex items-center gap-[clamp(9px,0.9vw,16px)] overflow-x-auto px-[var(--bp-gutter)] py-[clamp(6px,0.8vh,12px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {rail.map((s) => (
                          <div key={s.key} className="contents">
                            {s.node}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <BpPlayerRail
                        panels={panels}
                        panel={panel}
                        playback={playback}
                        onOpenPanel={openPanel}
                      />
                    )}
                  </BpRailRow>
                )}
              </div>
            </div>
            <div
              className={`transition-opacity duration-[var(--bp-dur)] motion-reduce:transition-none ${
                up && !activePanel ? "opacity-100" : "opacity-0"
              }`}
            >
              <BpHintBar actions={HINTS} />
            </div>
          </div>
        )}

        {/* Above the stage, which is z-30: a skip pill painting over an open
            subtitle picker is the kind of thing nobody notices until a tester
            reports that the panel "flickers". */}
        {activePanel && (
          <div className="pointer-events-auto absolute inset-0 z-[60]">{activePanel.node}</div>
        )}
      </div>
    </BpPlayerProvider>,
    document.body,
  );
}
