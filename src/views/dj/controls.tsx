import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

const REACH = 200;
const FINE_DIVISOR = 10;
const LATCH_MS = 1200;
const DEAD_ZONE = 2;
const REST_MS = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quantize(value: number, step: number, min: number, max: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  const places = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
  return clamp(Number(snapped.toFixed(places)), min, max);
}

function blockAutoScroll(event: MouseEvent<HTMLElement>) {
  if (event.button === 1) event.preventDefault();
}

function isFine(event: { shiftKey: boolean; buttons: number }): boolean {
  return event.shiftKey || (event.buttons & 4) !== 0;
}

function useWheelAdjust(nudge: (direction: number, fine: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(nudge);
  latest.current = nudge;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current(event.deltaY < 0 ? 1 : -1, event.shiftKey);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);
  return ref;
}

function useLatch(value: number) {
  const [held, setHeld] = useState<number | null>(null);
  const aim = useRef<number | null>(null);
  const live = useRef(value);
  const timer = useRef(0);
  live.current = value;

  useEffect(() => {
    const target = aim.current;
    if (target === null) return;
    if (Math.abs(value - target) > 0.0005 + Math.abs(target) * 0.002) return;
    aim.current = null;
    window.clearTimeout(timer.current);
    setHeld(null);
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const push = useCallback((next: number) => {
    aim.current = next;
    setHeld(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      aim.current = null;
      setHeld(null);
    }, LATCH_MS);
  }, []);

  const read = useCallback(() => aim.current ?? live.current, []);

  return { shown: held ?? value, read, push };
}

function useThrow(span: number, min: number, max: number, apply: (value: number) => void) {
  const grip = useRef<{ value: number; moved: number } | null>(null);
  const latest = useRef(apply);
  latest.current = apply;

  const grab = useCallback((event: PointerEvent<HTMLElement>, from: number) => {
    if (event.button === 1) event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    grip.current = { value: from, moved: 0 };
  }, []);

  const drag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const held = grip.current;
      if (!held) return;
      const reach = isFine(event) ? REACH * FINE_DIVISOR : REACH;
      held.value = clamp(held.value - (event.movementY / reach) * span, min, max);
      held.moved += Math.abs(event.movementY);
      if (held.moved < DEAD_ZONE) return;
      latest.current(held.value);
    },
    [max, min, span],
  );

  const drop = useCallback(() => {
    grip.current = null;
  }, []);

  return { grab, drag, drop };
}

export function composeEq(kills: Record<string, boolean>, filter: number): number[] {
  const bands = Array(10).fill(0) as number[];
  const amount = Math.min(1, Math.abs(filter));
  if (amount > 0.02) {
    const edge = filter < 0 ? 9 - amount * 9.5 : amount * 9.5;
    for (let index = 0; index < 10; index += 1) {
      const distance = filter < 0 ? index - edge : edge - index;
      if (distance > 0) bands[index] = Math.max(-12, -distance * 6);
    }
  }
  const zones: Record<string, number[]> = { low: [0, 1, 2], mid: [3, 4, 5, 6], high: [7, 8, 9] };
  for (const [zone, indexes] of Object.entries(zones)) {
    if (!kills[zone]) continue;
    for (const index of indexes) bands[index] = -12;
  }
  return bands;
}

export function Knob({
  label,
  value,
  min,
  max,
  readout,
  onChange,
  onReset,
  onSettle,
  tone,
  step,
  size,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  readout: string | ((value: number) => string);
  onChange: (value: number) => void;
  onReset: () => void;
  onSettle?: () => void;
  tone?: "amber" | "cyan";
  step?: number;
  size?: "sm" | "md";
}) {
  const span = max - min;
  const [rescale, setRescale] = useState(false);
  const lastSpan = useRef(span);
  useEffect(() => {
    if (lastSpan.current === span) return;
    lastSpan.current = span;
    setRescale(true);
    const timer = window.setTimeout(() => setRescale(false), 340);
    return () => window.clearTimeout(timer);
  }, [span]);
  const { shown, read, push } = useLatch(value);
  const settle = useRef(onSettle ?? (() => {}));
  settle.current = onSettle ?? (() => {});
  const rest = useRef(0);
  const restSettle = useCallback(() => {
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => settle.current(), REST_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(rest.current), []);

  const apply = useCallback(
    (next: number) => {
      push(next);
      onChange(next);
    },
    [onChange, push],
  );
  const { grab, drag, drop } = useThrow(span, min, max, apply);

  const tick = step ?? span / 100;
  const wheel = useWheelAdjust((direction, precise) => {
    const grain = precise ? tick / FINE_DIVISOR : tick;
    apply(quantize(read() + direction * grain, grain, min, max));
    restSettle();
  });

  const ratio = span === 0 ? 0 : (shown - min) / span;
  const bipolar = min < 0 && max > 0;
  const centre = bipolar ? -min / span : 0;

  const release = () => {
    drop();
    restSettle();
  };

  return (
    <div
      className="dj-knob"
      data-tone={tone}
      data-size={size ?? "md"}
      data-bipolar={bipolar || undefined}
      data-rescale={rescale || undefined}
      ref={wheel}
    >
      <div
        className="dj-knob-body"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(shown.toFixed(2))}
        style={{
          ["--dj-angle" as string]: `${-140 + ratio * 280}deg`,
          ["--dj-arc-from" as string]: `${Math.min(centre, ratio)}`,
          ["--dj-arc-to" as string]: `${Math.max(centre, ratio)}`,
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return;
          grab(event, read());
        }}
        onMouseDown={blockAutoScroll}
        onAuxClick={blockAutoScroll}
        onPointerMove={drag}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={drop}
        onDoubleClick={onReset}
        onKeyDown={(event) => {
          const grain = event.shiftKey ? tick / FINE_DIVISOR : tick;
          if (event.key === "ArrowUp") apply(quantize(read() + grain, grain, min, max));
          else if (event.key === "ArrowDown") apply(quantize(read() - grain, grain, min, max));
          else return;
          event.preventDefault();
        }}
        onKeyUp={restSettle}
      >
        <span className="dj-knob-track" aria-hidden="true" />
        <span className="dj-knob-cap" aria-hidden="true">
          <i />
        </span>
      </div>
      <span className="dj-knob-label">{label}</span>
      <button type="button" className="dj-knob-readout" onClick={onReset}>
        {typeof readout === "function" ? readout(shown) : readout}
      </button>
    </div>
  );
}

export function Fader({
  label,
  value,
  min,
  max,
  step,
  readout,
  onChange,
  onReset,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  readout: string | ((value: number) => string);
  onChange: (value: number) => void;
  onReset: () => void;
  onCommit?: (value: number) => void;
}) {
  const span = max - min;
  const { shown, read, push } = useLatch(value);
  const send = useRef(onCommit);
  send.current = onCommit;
  const rest = useRef(0);
  const restCommit = useCallback(() => {
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => send.current?.(read()), REST_MS);
  }, [read]);
  useEffect(() => () => window.clearTimeout(rest.current), []);

  const apply = useCallback(
    (next: number) => {
      push(next);
      onChange(next);
    },
    [onChange, push],
  );
  const snap = useCallback(
    (next: number) => apply(quantize(next, step, min, max)),
    [apply, max, min, step],
  );
  const { grab, drag, drop } = useThrow(span, min, max, snap);
  const wheel = useWheelAdjust((direction, precise) => {
    const grain = precise ? step / FINE_DIVISOR : step;
    apply(quantize(read() + direction * grain, grain, min, max));
    restCommit();
  });

  const bipolar = min < 0 && max > 0;
  const ratio = span === 0 ? 0 : (shown - min) / span;
  const commit = () => {
    window.clearTimeout(rest.current);
    drop();
    send.current?.(read());
  };

  return (
    <div
      className="dj-fader"
      data-bipolar={bipolar || undefined}
      style={{ ["--dj-fill" as string]: `${ratio}` }}
      ref={wheel}
    >
      <span className="dj-fader-label">{label}</span>
      <div
        className="dj-fader-slot"
        onPointerDownCapture={(event) => {
          if (event.button !== 1) return;
          event.stopPropagation();
          grab(event, read());
        }}
        onPointerMove={drag}
        onPointerUp={commit}
        onPointerCancel={commit}
        onLostPointerCapture={drop}
        onMouseDown={blockAutoScroll}
        onAuxClick={blockAutoScroll}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          aria-label={label}
          onChange={(event) => apply(Number(event.target.value))}
          onKeyUp={commit}
          onBlur={commit}
          onDoubleClick={onReset}
        />
      </div>
      <button type="button" className="dj-fader-readout" onClick={onReset}>
        {typeof readout === "function" ? readout(shown) : readout}
      </button>
    </div>
  );
}

export function Hardware({
  label,
  tone,
  lit,
  disabled,
  onClick,
  onContextMenu,
  children,
  wide,
  size,
}: {
  label?: string;
  tone?: "amber" | "red" | "green" | "cyan" | "steel" | "accent";
  lit?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onContextMenu?: () => void;
  children?: ReactNode;
  wide?: boolean;
  size?: "chip" | "key" | "pad";
}) {
  return (
    <button
      type="button"
      className="dj-hardware"
      data-size={size ?? "key"}
      data-tone={tone ?? "steel"}
      data-lit={lit || undefined}
      data-wide={wide || undefined}
      disabled={disabled}
      aria-pressed={lit}
      aria-label={label}
      onClick={onClick}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu();
      }}
    >
      <span className="dj-hardware-face">{children ?? label}</span>
    </button>
  );
}
