import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, Clock, Gauge } from "lucide-react";
import { useMobileRemote } from "./mobile-remote";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEPS: Array<{ label: string; minutes: number }> = [
  { label: "Off", minutes: 0 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SHEET_EXIT_MS = 300;

export const SHEET_EXIT_CSS = `
.harbor-sheet-scrim-out { animation: harbor-sheet-scrim-out ${SHEET_EXIT_MS}ms var(--ease-out) both; pointer-events: none; }
.harbor-sheet-panel-out { animation: harbor-sheet-panel-out ${SHEET_EXIT_MS}ms var(--ease-out) both; pointer-events: none; }
@keyframes harbor-sheet-scrim-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes harbor-sheet-panel-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-sheet-scrim-out, .harbor-sheet-panel-out { animation: none; }
}
`;

export function useSheetPresence(open: boolean) {
  const [reduced] = useState(prefersReducedMotion);
  const [presence, setPresence] = useState({ open, retained: open });
  if (presence.open !== open) {
    setPresence({ open, retained: open || presence.retained });
  }
  const render = open || (!reduced && presence.retained);
  const leaving = !open && render;

  useEffect(() => {
    if (open || reduced || !presence.retained) return;
    const t = window.setTimeout(() => {
      setPresence((current) => ({ ...current, retained: false }));
    }, SHEET_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, presence.retained, reduced]);

  return { render, leaving };
}

export function useSheetDrag(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const [active, setActive] = useState(false);
  const drag = useRef({ active: false, startY: 0, id: -1 });

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    drag.current = { active: true, startY: e.clientY, id: e.pointerId };
    setActive(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    const delta = e.clientY - d.startY;
    setDy(delta > 0 ? delta : delta * 0.16);
  };
  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    setActive(false);
    const delta = e.clientY - d.startY;
    if (delta > 110) onClose();
    else setDy(0);
  };

  const panelStyle: CSSProperties = {
    transform: dy ? `translateY(${dy}px)` : undefined,
    transition: active ? "none" : "transform 260ms var(--ease-out)",
  };
  return {
    handleProps: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
    panelStyle,
  };
}

export function KeyboardOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendCommand, snapshot } = useMobileRemote();
  const { render, leaving } = useSheetPresence(open);

  if (!render) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col bg-canvas ${leaving ? "harbor-sheet-scrim-out" : "animate-fade-in"}`}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div className="flex items-center justify-between px-5 pb-3">
        <span className="text-[13px] font-semibold text-ink-muted">Typing on your computer</span>
        <button
          type="button"
          onClick={() => {
            sendCommand({ action: "blurText" });
            onClose();
          }}
          className="flex h-9 items-center rounded-full bg-elevated/70 px-4 text-[13.5px] font-semibold text-ink"
        >
          Done
        </button>
      </div>
      <KeyboardInput
        key={open ? "open" : "closed"}
        open={open}
        initialValue={snapshot.textEntry?.value ?? ""}
        placeholder={snapshot.textEntry?.placeholder ?? "Type to search…"}
        onChange={(value) => sendCommand({ action: "setText", value })}
        onSubmit={(value) => {
          sendCommand({ action: "submitText", value });
          onClose();
        }}
      />
    </div>
  );
}

function KeyboardInput({
  open,
  initialValue,
  placeholder,
  onChange,
  onSubmit,
}: {
  open: boolean;
  initialValue: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(value);
      }}
      enterKeyHint="search"
      placeholder={placeholder}
      className="w-full flex-1 bg-transparent px-5 font-display text-[clamp(1.6rem,7vw,2.4rem)] leading-tight tracking-tight text-ink placeholder:text-ink-subtle focus:outline-none"
    />
  );
}

export function SpeedSleepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendCommand } = useMobileRemote();
  const [speed, setSpeed] = useState(1);
  const [sleep, setSleep] = useState(0);
  const { render, leaving } = useSheetPresence(open);
  if (!render) return null;
  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${leaving ? "harbor-sheet-scrim-out" : "animate-fade-in"}`}
      onClick={onClose}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`flex flex-col gap-6 rounded-t-[28px] border-t border-edge-soft/60 bg-elevated px-5 pt-4 ${leaving ? "harbor-sheet-panel-out" : "animate-in slide-in-from-bottom-4 duration-300"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Gauge size={17} strokeWidth={2.2} className="text-ink-muted" />
            Playback speed
          </h3>
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((s) => (
              <Chip
                key={s}
                active={speed === s}
                onClick={() => {
                  setSpeed(s);
                  sendCommand({ action: "setSpeed", speed: s });
                }}
              >
                {s === 1 ? "1×" : `${s}×`}
              </Chip>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Clock size={17} strokeWidth={2.2} className="text-ink-muted" />
            Sleep timer
          </h3>
          <div className="flex flex-wrap gap-2">
            {SLEEPS.map((s) => (
              <Chip
                key={s.minutes}
                active={sleep === s.minutes}
                onClick={() => {
                  setSleep(s.minutes);
                  sendCommand({ action: "setSleep", minutes: s.minutes });
                }}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${
        active ? "bg-accent text-canvas" : "bg-raised text-ink-muted"
      }`}
    >
      {active && <Check size={14} strokeWidth={3} />}
      {children}
    </button>
  );
}
