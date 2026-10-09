import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { scratchDeck, sendDeckCommand } from "@/lib/music/deck-sync";
import {
  HandTrack,
  RELEASE_SECONDS,
  RELEASE_TAU,
  REVERSAL_SECONDS,
  SECONDS_PER_TURN,
} from "./scratch-physics";
import { acquireTakeover, dropTakeover, type Takeover } from "./takeover";

const SEND_MS = 16;
const LOCK_TAU = 0.47;
const CATCH = 0.25;
const DEG_PER_SECOND = 360 / SECONDS_PER_TURN;
const PRIME_MS = 2500;
const STROBE = Array.from({ length: 60 }, (_, index) => index);

function wrap360(deg: number): number {
  const turn = deg % 360;
  return turn < 0 ? turn + 360 : turn;
}

function wrap180(deg: number): number {
  return wrap360(deg + 180) - 180;
}

type Held = {
  angle: number;
  position: number;
  ticket: number;
  heading: number;
  reversed: boolean;
};

export function Platter({
  artwork,
  trackKey,
  playing,
  progress,
  readPosition,
  duration,
  speed,
  size,
}: {
  artwork?: string;
  trackKey: string;
  playing: boolean;
  progress: number;
  readPosition: () => number;
  duration: number;
  speed: number;
  size: "compact" | "full";
}) {
  const root = useRef<HTMLDivElement>(null);
  const record = useRef<HTMLSpanElement>(null);
  const held = useRef<Held | null>(null);
  const hand = useRef(new HandTrack());
  const coasting = useRef(false);
  const landing = useRef(0);
  const sentAt = useRef(0);
  const shown = useRef(0);
  const primed = useRef(false);
  const deck = useRef<Takeover | null>(null);
  const owned = useRef(0);
  const [scratching, setScratching] = useState(false);
  const live = useRef(readPosition);
  live.current = readPosition;
  const spinning = useRef(playing);
  spinning.current = playing;
  const tempo = useRef(speed);
  tempo.current = speed;

  const cap = useCallback(
    (position: number) => {
      const bounded = Math.max(0, position);
      return duration > 0 ? Math.min(duration, bounded) : bounded;
    },
    [duration],
  );

  useEffect(() => {
    const engine = acquireTakeover();
    deck.current = engine;
    return () => {
      window.clearTimeout(landing.current);
      deck.current = null;
      const grip = held.current;
      held.current = null;
      if (grip && !grip.ticket) void scratchDeck(Math.max(0, grip.position), 1, false);
      engine.release(owned.current, true);
      owned.current = 0;
      dropTakeover();
    };
  }, []);

  useEffect(() => {
    deck.current?.setDeckRate(playing ? speed : 0);
  }, [playing, speed]);

  useEffect(() => {
    primed.current = false;
    const engine = deck.current;
    if (!engine) return;
    engine.reset(trackKey);
    if (!trackKey) return;
    const tick = () => {
      if (held.current || engine.busy) return;
      void engine.prime(live.current());
    };
    tick();
    const timer = window.setInterval(tick, PRIME_MS);
    return () => window.clearInterval(timer);
  }, [trackKey]);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    let last = performance.now();
    const step = () => {
      if (!alive) return;
      const now = performance.now();
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;

      const grip = held.current;
      const engine = deck.current;
      if (grip) {
        if (grip.ticket && engine) {
          engine.hand(grip.ticket, grip.position, hand.current.velocity(now / 1000));
        }
        shown.current = wrap360((grip.position / SECONDS_PER_TURN) * 360);
      } else if (coasting.current && engine) {
        shown.current = wrap360((engine.playhead / SECONDS_PER_TURN) * 360);
      } else {
        const spin = DEG_PER_SECOND * tempo.current;
        if (spinning.current) shown.current += elapsed * spin;
        const truth = wrap360((live.current() / SECONDS_PER_TURN) * 360);
        if (primed.current) {
          const drift = wrap180(truth - shown.current);
          const pull = drift * (1 - Math.exp(-elapsed / LOCK_TAU));
          const room = elapsed * spin * CATCH;
          const nudge = spinning.current ? Math.max(-room, Math.min(room, pull)) : pull;
          shown.current = wrap360(shown.current + nudge);
        } else {
          primed.current = true;
          shown.current = truth;
        }
      }

      record.current?.style.setProperty("--dj-hand", `${shown.current.toFixed(2)}deg`);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  const angleAt = useCallback((event: { clientX: number; clientY: number }) => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.atan2(
      event.clientY - (box.top + box.height / 2),
      event.clientX - (box.left + box.width / 2),
    );
  }, []);

  const onDisc = useCallback((event: { clientX: number; clientY: number }) => {
    const box = root.current?.getBoundingClientRect();
    if (!box || !box.width) return false;
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    return Math.hypot(dx, dy) <= box.width / 2;
  }, []);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !onDisc(event)) return;
    window.clearTimeout(landing.current);
    coasting.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = readPosition();
    const ticket = deck.current?.claim(position, playing ? speed : 0) ?? 0;
    owned.current = ticket;
    hand.current.clear(performance.now() / 1000, position);
    held.current = { angle: angleAt(event), position, ticket, heading: 0, reversed: false };
    setScratching(true);
    if (!ticket) void scratchDeck(cap(position), 0, true);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const grip = held.current;
    if (!grip) return;
    const now = angleAt(event);
    let delta = now - grip.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    grip.angle = now;

    const moment = performance.now();
    const shift = (delta / (Math.PI * 2)) * SECONDS_PER_TURN;
    if (Math.abs(shift) > REVERSAL_SECONDS) {
      const heading = shift > 0 ? 1 : -1;
      if (grip.heading !== 0 && heading !== grip.heading) grip.reversed = true;
      grip.heading = heading;
    }
    grip.position = Math.max(0, grip.position + shift);
    hand.current.push(moment / 1000, grip.position);
    if (grip.ticket) return;
    if (moment - sentAt.current < SEND_MS) return;
    sentAt.current = moment;
    const rate = hand.current.velocity(moment / 1000);
    void scratchDeck(cap(grip.position), rate, true);
  };

  const up = () => {
    const grip = held.current;
    held.current = null;
    setScratching(false);
    if (!grip) return;
    const engine = deck.current;
    if (!grip.ticket || !engine) {
      owned.current = 0;
      const landed = cap(grip.position);
      void scratchDeck(landed, 1, false);
      sendDeckCommand({ kind: "seek", seconds: landed });
      return;
    }
    coasting.current = true;
    engine.motor(grip.ticket, playing ? speed : 0, RELEASE_TAU);
    window.clearTimeout(landing.current);
    landing.current = window.setTimeout(() => {
      coasting.current = false;
      const landed = cap(engine.playhead);
      const handed = engine.release(grip.ticket, grip.reversed, landed);
      if (owned.current === grip.ticket) owned.current = 0;
      if (handed && !grip.reversed) sendDeckCommand({ kind: "seek", seconds: landed });
    }, RELEASE_SECONDS * 1000);
  };

  const sweep = Math.max(0, Math.min(1, progress)) * 360;

  return (
    <div
      ref={root}
      className="dj-platter"
      data-size={size}
      data-spinning={playing && !scratching ? "" : undefined}
      data-scratching={scratching || undefined}
      style={{ ["--dj-sweep" as string]: `${sweep}deg` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span className="dj-platter-progress" aria-hidden="true" />
      <span className="dj-platter-deck" aria-hidden="true">
        {STROBE.map((index) => (
          <i key={index} style={{ ["--dj-dot" as string]: `${index * 6}deg` }} />
        ))}
      </span>
      <span className="dj-platter-sheen" aria-hidden="true" />
      <span ref={record} className="dj-platter-record">
        <span className="dj-platter-grooves" aria-hidden="true" />
        {artwork ? (
          <img className="dj-platter-label" src={artwork} alt="" draggable={false} />
        ) : (
          <span className="dj-platter-label dj-platter-blank" />
        )}
        <span className="dj-platter-spindle" aria-hidden="true" />
      </span>
    </div>
  );
}
