import { useEffect, useRef, useState } from "react";
import { ChevronDown, Monitor, Volume2, VolumeX } from "lucide-react";
import type { RemoteNavKey, RemoteSnapshot } from "@/lib/remote/protocol";
import { SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";
import { useMobileRemote } from "./mobile-remote";
import { useRegisterSheet } from "./mobile-sheet-lock";
import { MobileServices } from "./mobile-services";
import { RendererSheet } from "./renderer-sheet";
import { KeyboardOverlay, SHEET_EXIT_CSS, SpeedSleepSheet } from "./remote-extras";
import { VoiceSearch, getSpeechRecognition } from "./voice-search";

type Service = (typeof SERVICES)[StreamingService];

const PROVIDER_KEYS: StreamingService[] = [
  "netflix",
  "prime",
  "disney",
  "max",
  "hulu",
  "crunchyroll",
];

type Dir = "up" | "right" | "down" | "left";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SEGMENTS: Array<{ dir: Dir; clip: string; fill: string }> = [
  { dir: "up", clip: "polygon(50% 47%, -17% -20%, 117% -20%)", fill: "to top" },
  { dir: "right", clip: "polygon(53% 50%, 120% -17%, 120% 117%)", fill: "to right" },
  { dir: "down", clip: "polygon(50% 53%, 117% 120%, -17% 120%)", fill: "to bottom" },
  { dir: "left", clip: "polygon(47% 50%, -20% 117%, -20% -17%)", fill: "to left" },
];

const SVC_EXIT_CSS = `
.harbor-svc-exit { animation: harbor-svc-exit 260ms var(--ease-out) both; pointer-events: none; }
@keyframes harbor-svc-exit {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(18px); }
}
@media (prefers-reduced-motion: reduce) { .harbor-svc-exit { animation: none; } }
`;

const CHEVRONS: Array<{ dir: Dir; rotate: number; pos: string; nudge: string }> = [
  { dir: "up", rotate: 0, pos: "inset-x-0 top-[11%] mx-auto w-max", nudge: "translateY(-5px)" },
  {
    dir: "down",
    rotate: 180,
    pos: "inset-x-0 bottom-[11%] mx-auto w-max",
    nudge: "translateY(5px)",
  },
  {
    dir: "left",
    rotate: 270,
    pos: "inset-y-0 start-[10%] my-auto h-max",
    nudge: "translateX(-5px)",
  },
  { dir: "right", rotate: 90, pos: "inset-y-0 end-[10%] my-auto h-max", nudge: "translateX(5px)" },
];

export function DpadRemote() {
  const { sendCommand, snapshot, connected } = useMobileRemote();
  const nav = (key: RemoteNavKey) => sendCommand({ action: "nav", key });
  const playing = snapshot.playing && !snapshot.idle;
  const watching = !!snapshot.mediaId && !snapshot.idle;
  const pagerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [services, setServices] = useState<{ open: boolean; initial?: StreamingService }>({
    open: false,
  });
  const [servicesExiting, setServicesExiting] = useState(false);
  const closeServices = () => {
    setServicesExiting(true);
    window.setTimeout(() => {
      setServices({ open: false });
      setServicesExiting(false);
    }, 260);
  };
  const [pressed, setPressed] = useState<Dir | null>(null);
  const [holding, setHolding] = useState(false);
  const [okDown, setOkDown] = useState(false);
  const [confirm, setConfirm] = useState<null | "back" | "home">(null);
  const [confirmLeaving, setConfirmLeaving] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const closeConfirm = () => {
    if (reduced) {
      setConfirm(null);
      setConfirmLeaving(false);
      return;
    }
    setConfirmLeaving(true);
    window.setTimeout(() => {
      setConfirm(null);
      setConfirmLeaving(false);
    }, 300);
  };

  useRegisterSheet(speedOpen);
  useRegisterSheet(sheetOpen);
  useRegisterSheet(kbOpen);
  useRegisterSheet(voiceOpen);
  useRegisterSheet(services.open);
  useRegisterSheet(confirm !== null && !confirmLeaving);

  const holdDir = useRef<Dir | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const holdDelay = useRef(340);
  const releaseTimer = useRef<number | undefined>(undefined);

  const tick = () => {
    const dir = holdDir.current;
    if (!dir) return;
    nav(dir);
    setHolding(true);
    holdDelay.current = Math.max(85, holdDelay.current - 42);
    holdTimer.current = window.setTimeout(tick, holdDelay.current);
  };

  const startPress = (dir: Dir) => {
    window.clearTimeout(releaseTimer.current);
    nav(dir);
    setPressed(dir);
    holdDir.current = dir;
    holdDelay.current = 340;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(tick, 380);
  };

  const endPress = () => {
    holdDir.current = null;
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      setPressed(null);
      setHolding(false);
    }, 120);
  };

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(releaseTimer.current);
    },
    [],
  );

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w > 0) setPage(Math.round(el.scrollLeft / w));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-5 pt-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
    >
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex items-center gap-2 text-[13.5px] font-semibold transition-opacity active:opacity-60"
      >
        <Monitor
          size={15}
          strokeWidth={2.2}
          className={connected ? "text-ink" : "text-ink-subtle"}
        />
        <span className="text-ink">
          {connected ? snapshot.target.label || "Your computer" : "Connecting…"}
        </span>
        <ChevronDown size={15} strokeWidth={2.4} className="text-ink-subtle" />
      </button>

      <div className="relative aspect-square w-full max-w-[300px] select-none">
        <div className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1.5px_var(--color-edge-soft)]">
          {SEGMENTS.map(({ dir, clip, fill }) => (
            <button
              key={dir}
              type="button"
              aria-label={dir}
              onPointerDown={(e) => {
                e.preventDefault();
                startPress(dir);
              }}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              className="absolute inset-0 bg-elevated outline-none"
              style={{ clipPath: clip, touchAction: "manipulation" }}
            >
              <span
                aria-hidden
                className="absolute inset-0 transition-opacity duration-200 ease-out"
                style={{
                  background: `linear-gradient(${fill}, color-mix(in oklch, var(--color-accent) 6%, transparent), color-mix(in oklch, var(--color-accent) 46%, transparent))`,
                  opacity: pressed === dir ? 1 : 0,
                }}
              />
              <span
                aria-hidden
                className="absolute inset-0 transition-opacity duration-[240ms] ease-out"
                style={{
                  background: `linear-gradient(${fill}, color-mix(in oklch, var(--color-accent) 24%, transparent), color-mix(in oklch, var(--color-accent) 70%, transparent))`,
                  opacity: holding && pressed === dir ? 1 : 0,
                }}
              />
            </button>
          ))}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--color-canvas) 33%, transparent 34%)",
            }}
          />
        </div>

        {CHEVRONS.map(({ dir, rotate, pos, nudge }) => (
          <span
            key={dir}
            aria-hidden
            className={`pointer-events-none absolute ${pos} text-ink-muted transition-[transform,color] duration-200 ease-[cubic-bezier(0.34,1.5,0.5,1)]`}
            style={{
              transform:
                pressed === dir && !reduced
                  ? `${nudge} scale(${holding ? 1.22 : 1.16})`
                  : undefined,
              color: pressed === dir ? "var(--color-accent)" : undefined,
            }}
          >
            <img
              src="/remote-icons/up.png"
              alt=""
              aria-hidden
              draggable={false}
              className="object-contain"
              style={{ width: 34, height: 34, transform: `rotate(${rotate}deg)` }}
            />
          </span>
        ))}

        <button
          type="button"
          aria-label="Select"
          onPointerDown={(e) => {
            e.preventDefault();
            setOkDown(true);
            nav("select");
          }}
          onPointerUp={() => setOkDown(false)}
          onPointerLeave={() => setOkDown(false)}
          onPointerCancel={() => setOkDown(false)}
          className="absolute inset-0 z-10 m-auto grid h-[42%] w-[42%] place-items-center rounded-full bg-raised text-[16px] font-semibold tracking-wide text-ink-subtle outline-none shadow-[0_14px_30px_-14px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] transition-[transform] duration-150"
          style={{
            transform: okDown && !reduced ? "scale(0.92)" : undefined,
            touchAction: "manipulation",
            textShadow: "0 -1px 1px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          OK
        </button>
      </div>

      <div className="flex w-full max-w-[352px] items-center justify-between px-2">
        <Util label="Speed & sleep" onPress={() => setSpeedOpen(true)}>
          <RemoteIcon name="sleep_timer" size={24} />
        </Util>
        <Util label="Keyboard" onPress={() => setKbOpen(true)}>
          <RemoteIcon name="keyboard" size={24} />
        </Util>
        <Util
          label="Voice"
          accent
          onPress={() => {
            if (getSpeechRecognition()) setVoiceOpen(true);
            else sendCommand({ action: "openSearch" });
          }}
        >
          <RemoteIcon name="microphone" size={26} />
        </Util>
        <Util label="Apps" onPress={() => setServices({ open: true })}>
          <RemoteIcon name="apps_grid" size={24} />
        </Util>
        <Util label="More" onPress={() => {}}>
          <RemoteIcon name="more" size={24} />
        </Util>
      </div>

      <div className="h-px w-full max-w-[352px] bg-edge-soft/60" />

      <div
        ref={pagerRef}
        className="flex w-full max-w-[360px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
      >
        <Pane>
          <div className="flex w-full justify-around">
            <Circle label="Back" onPress={() => (watching ? setConfirm("back") : nav("back"))}>
              <RemoteIcon name="back" size={26} />
            </Circle>
            <Circle
              label="Home"
              onPress={() =>
                watching ? setConfirm("home") : sendCommand({ action: "goView", view: "home" })
              }
            >
              <RemoteIcon name="home" size={26} />
            </Circle>
            <Circle label="Menu" onPress={() => sendCommand({ action: "openSearch" })}>
              <RemoteIcon name="menu" size={26} />
            </Circle>
          </div>
          <div className="flex w-full items-center justify-around">
            <Circle
              label="Rewind"
              onPress={() =>
                sendCommand({ action: "seek", positionSec: Math.max(0, snapshot.positionSec - 10) })
              }
            >
              <RemoteIcon name="previous" size={26} />
            </Circle>
            <Circle
              label={playing ? "Pause" : "Play"}
              big
              onPress={() => sendCommand({ action: playing ? "pause" : "play" })}
            >
              {playing ? (
                <RemoteIcon name="pause" size={32} />
              ) : (
                <RemoteIcon name="play" size={32} />
              )}
            </Circle>
            <Circle
              label="Forward"
              onPress={() =>
                sendCommand({ action: "seek", positionSec: snapshot.positionSec + 10 })
              }
            >
              <RemoteIcon name="previous" size={26} flip />
            </Circle>
          </div>
        </Pane>

        <Pane>
          <div className="flex w-full justify-around">
            <Circle
              label="Volume down"
              onPress={() =>
                sendCommand({
                  action: "setVolume",
                  volume: Math.max(0, (snapshot.volume ?? 1) - 0.1),
                })
              }
            >
              <VolumeX size={26} strokeWidth={2.2} />
            </Circle>
            <Circle
              label="Mute"
              onPress={() => sendCommand({ action: "setMuted", muted: !snapshot.muted })}
            >
              {snapshot.muted ? (
                <VolumeX size={26} strokeWidth={2.2} />
              ) : (
                <Volume2 size={26} strokeWidth={2.2} />
              )}
            </Circle>
            <Circle
              label="Volume up"
              onPress={() =>
                sendCommand({
                  action: "setVolume",
                  volume: Math.min(1, (snapshot.volume ?? 1) + 0.1),
                })
              }
            >
              <Volume2 size={26} strokeWidth={2.2} />
            </Circle>
          </div>
          <div className="flex w-full justify-around">
            <Circle label="Subtitles" onPress={() => sendCommand({ action: "toggleSubtitles" })}>
              <RemoteIcon name="captions" size={26} />
            </Circle>
          </div>
        </Pane>

        <Pane>
          <div className="grid grid-cols-3 gap-2.5">
            {PROVIDER_KEYS.map((svc) => (
              <ProviderCard
                key={svc}
                svc={svc}
                service={SERVICES[svc]}
                onPress={() => setServices({ open: true, initial: svc })}
              />
            ))}
          </div>
        </Pane>
      </div>

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-ink" : "w-1.5 bg-ink/25"}`}
          />
        ))}
      </div>

      <RendererSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <KeyboardOverlay open={kbOpen} onClose={() => setKbOpen(false)} />
      <SpeedSleepSheet open={speedOpen} onClose={() => setSpeedOpen(false)} />
      {services.open && (
        <div
          className={`fixed inset-0 z-[60] overflow-y-auto bg-canvas ${servicesExiting ? "harbor-svc-exit" : ""}`}
        >
          <style>{SVC_EXIT_CSS}</style>
          <MobileServices initialService={services.initial} onBack={closeServices} />
        </div>
      )}
      {confirm && (
        <ConfirmLeave
          snapshot={snapshot}
          reduced={reduced}
          leaving={confirmLeaving}
          onCancel={closeConfirm}
          onConfirm={() => {
            if (confirm === "back") nav("back");
            else sendCommand({ action: "goView", view: "home" });
            closeConfirm();
          }}
        />
      )}
      {voiceOpen && (
        <VoiceSearch
          onClose={() => setVoiceOpen(false)}
          onSubmit={(text) => {
            sendCommand({ action: "openSearch" });
            window.setTimeout(() => {
              sendCommand({ action: "setText", value: text });
              sendCommand({ action: "submitText", value: text });
            }, 120);
          }}
        />
      )}
    </div>
  );
}

function RemoteIcon({
  name,
  size = 22,
  flip = false,
}: {
  name: string;
  size?: number;
  flip?: boolean;
}) {
  return (
    <img
      src={`/remote-icons/${name}.png`}
      alt=""
      aria-hidden
      draggable={false}
      style={{ width: size, height: size, transform: flip ? "scaleX(-1)" : undefined }}
      className="object-contain"
    />
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full shrink-0 snap-center flex-col gap-6 px-2">{children}</div>;
}

function Util({
  label,
  onPress,
  accent,
  children,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={`flex items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
        accent
          ? "h-14 w-14 bg-accent text-canvas shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]"
          : "h-11 w-11 text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Circle({
  label,
  onPress,
  big,
  children,
}: {
  label: string;
  onPress: () => void;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={`flex items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
        big
          ? "h-[64px] w-[64px] bg-accent text-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]"
          : "h-[54px] w-[54px] bg-elevated/60 text-ink ring-1 ring-edge-soft/50"
      }`}
    >
      {children}
    </button>
  );
}

function ProviderCard({
  svc,
  service,
  onPress,
}: {
  svc: StreamingService;
  service: Service;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={service.name}
      data-svc={svc}
      onClick={onPress}
      className="flex aspect-[16/10] items-center justify-center rounded-xl bg-elevated/60 px-2 ring-1 ring-edge-soft/50 transition-transform duration-100 active:scale-[0.95]"
    >
      <img
        src={service.logo}
        alt={service.name}
        className="max-h-[24px] max-w-[78%] object-contain"
        style={{ filter: "brightness(0) invert(1)" }}
      />
    </button>
  );
}

function ConfirmLeave({
  snapshot,
  reduced,
  leaving,
  onCancel,
  onConfirm,
}: {
  snapshot: RemoteSnapshot;
  reduced: boolean;
  leaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const remainingMin =
    snapshot.durationSec > 0
      ? Math.max(0, Math.round((snapshot.durationSec - snapshot.positionSec) / 60))
      : null;
  const ep = snapshot.episode;
  const meta = [
    ep ? `S${ep.season} E${ep.episode}` : null,
    remainingMin && remainingMin > 0 ? `${remainingMin} min left` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasCard = Boolean(snapshot.posterUrl || snapshot.mediaTitle || meta);

  return (
    <div
      className={`fixed inset-0 z-[75] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${
        reduced ? "" : leaving ? "harbor-sheet-scrim-out" : "animate-fade-in"
      }`}
      onClick={onCancel}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`flex flex-col gap-5 rounded-t-[28px] border-t border-edge-soft/60 bg-elevated px-5 pt-4 ${
          reduced
            ? ""
            : leaving
              ? "harbor-sheet-panel-out"
              : "animate-in slide-in-from-bottom-4 duration-300"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
        <h3 className="text-center text-[18px] font-semibold tracking-tight text-ink">
          {"Leave what you're watching?"}
        </h3>
        {hasCard && (
          <div className="flex items-center gap-3 rounded-2xl bg-raised/40 p-2.5">
            {snapshot.posterUrl && (
              <img
                src={snapshot.posterUrl}
                alt=""
                className="h-14 w-[38px] shrink-0 rounded-lg bg-raised object-cover"
              />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              {snapshot.mediaTitle && (
                <span className="truncate text-[14.5px] font-semibold text-ink">
                  {snapshot.mediaTitle}
                </span>
              )}
              {meta && <span className="truncate text-[12.5px] text-ink-muted">{meta}</span>}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`h-12 flex-1 rounded-full bg-raised text-[15px] font-semibold text-ink transition-transform duration-100 ${
              reduced ? "" : "active:scale-[0.97]"
            }`}
          >
            Keep watching
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-12 flex-1 rounded-full bg-ink text-[15px] font-semibold text-canvas transition-transform duration-100 ${
              reduced ? "" : "active:scale-[0.97]"
            }`}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
