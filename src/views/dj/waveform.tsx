import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { sendDeckCommand } from "@/lib/music/deck-sync";
import { deckStates } from "@/lib/music/decks";
import {
  beatPhase,
  GRID_MIN_CONFIDENCE,
  phaseDelta,
  refineOrigin,
  type BeatGrid,
} from "@/lib/music/waveform-dsp";
import { subscribeWaveform, type TrackWaveform } from "@/lib/music/waveform";
import { Hardware } from "./controls";
import {
  createScroll,
  holdScroll,
  resetScroll,
  settleScroll,
  stepScroll,
} from "./waveform-motion";
import { drawPlayhead } from "./waveform-paint";
import { createSheet, createTile, drawTile, paintSheet, syncTile } from "./waveform-tiles";

const TIGHT_SECONDS = 9;
const WIDE_SECONDS = 14;
const POLL_MS = 900;
const TEXT_EVERY = 8;
const SEEK_MS = 60;
const NUDGE_SECONDS = 5;

export function DeckWaveform({
  trackKey,
  duration,
  readPosition,
  size,
  playing,
  speed,
  onGrid,
}: {
  trackKey: string;
  duration: number;
  readPosition: () => number;
  size: "compact" | "full";
  playing: boolean;
  speed: number;
  onGrid?: (grid: BeatGrid | null) => void;
}) {
  const t = useT();
  const haul = useRef<{ x: number; at: number; per: number } | null>(null);
  const rails = useRef<{ left: number; width: number } | null>(null);
  const [hauling, setHauling] = useState(false);
  const scroll = useRef(createScroll());
  const ticked = useRef(performance.now());
  const rolling = useRef(playing);
  rolling.current = playing;
  const rate = useRef(speed);
  rate.current = speed;
  const shell = useRef<HTMLDivElement>(null);
  const zoom = useRef<HTMLCanvasElement>(null);
  const board = useRef<HTMLCanvasElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const gauge = useRef<HTMLSpanElement>(null);
  const drift = useRef<HTMLElement>(null);

  const [view, setView] = useState<TrackWaveform | null>(null);
  const [twinLive, setTwinLive] = useState(false);
  const [anchored, setAnchored] = useState(false);

  const held = useRef<TrackWaveform | null>(null);
  const tile = useRef(createTile());
  const sheet = useRef(createSheet());
  const twin = useRef({ at: 0, position: 0, live: false, paused: true });
  const mark = useRef<number | null>(null);
  const painted = useRef(-1);
  const ticks = useRef(0);
  const scrub = useRef({ at: 0, value: Number.NaN });
  const pixels = useRef(1);
  const reported = useRef<BeatGrid | null | undefined>(undefined);

  const clock = useRef(readPosition);
  clock.current = readPosition;
  const total = useRef(duration);
  total.current = duration;
  const wide = useRef(size === "full");
  wide.current = size === "full";
  const notify = useRef(onGrid);
  notify.current = onGrid;

  useEffect(() => {
    held.current = null;
    setView(null);
    mark.current = null;
    reported.current = undefined;
    setAnchored(false);
    haul.current = null;
    rails.current = null;
    setHauling(false);
    resetScroll(scroll.current);
    tile.current.stamp = -1;
    sheet.current.stamp = -1;
    painted.current = -1;
    return subscribeWaveform(trackKey, duration, (snapshot) => {
      held.current = snapshot;
      setView(snapshot);
    });
  }, [trackKey, duration]);

  useEffect(() => {
    const grid = view?.grid ?? null;
    const strong = grid && grid.confidence >= GRID_MIN_CONFIDENCE ? grid : null;
    if (reported.current === strong) return;
    reported.current = strong;
    notify.current?.(strong);
  }, [view]);

  useEffect(() => {
    const node = shell.current;
    if (!node) return;
    const fit = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      pixels.current = Math.max(1, Math.round(ratio));
      for (const canvas of [zoom.current, board.current]) {
        if (!canvas) continue;
        const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      }
      sheet.current.stamp = -1;
      painted.current = -1;
    };
    fit();
    rail.current?.setAttribute("aria-valuenow", "0");
    const watcher = new ResizeObserver(fit);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [size]);

  useEffect(() => {
    if (size !== "full") return;
    let alive = true;
    const poll = async () => {
      const [, deck] = await deckStates();
      if (!alive) return;
      twin.current = {
        at: performance.now(),
        position: deck.positionSeconds ?? 0,
        live: deck.live,
        paused: deck.paused,
      };
      if (!deck.live && mark.current !== null) {
        mark.current = null;
        setAnchored(false);
      }
      setTwinLive(deck.live);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [size]);

  const paint = useCallback(() => {
    const face = zoom.current;
    const strip = board.current;
    const ctx = face?.getContext("2d");
    const stripCtx = strip?.getContext("2d");
    if (!face || !ctx || !strip || !stripCtx) return;
    const data = held.current;
    const now = performance.now();
    const elapsed = (now - ticked.current) / 1000;
    ticked.current = now;
    if (!data || data.filled <= 0) {
      if (painted.current === -2) return;
      ctx.clearRect(0, 0, face.width, face.height);
      stripCtx.clearRect(0, 0, strip.width, strip.height);
      painted.current = -2;
      return;
    }
    const seconds = stepScroll(scroll.current, {
      elapsed,
      truth: Math.max(0, clock.current()),
      rate: rate.current,
      playing: rolling.current,
      length: total.current,
      now,
    });
    const fresh = tile.current.stamp === data.stamp && sheet.current.stamp === data.stamp;
    if (painted.current === seconds && fresh && !twin.current.live) return;
    painted.current = seconds;
    const weight = pixels.current;
    const span = wide.current ? WIDE_SECONDS : TIGHT_SECONDS;
    const length = Math.max(1, total.current);
    const grid = data.grid && data.grid.confidence >= GRID_MIN_CONFIDENCE ? data.grid : null;
    const ink = { peaks: data.peaks, filled: data.filled, stamp: data.stamp, grid };

    syncTile(tile.current, ink, seconds, span, face.width, face.height, weight, (at) =>
      data.grid
        ? refineOrigin(data.onset, data.filled, data.grid.period, data.grid.origin, at)
        : 0,
    );
    drawTile(ctx, tile.current, seconds, face.width, face.height);
    drawPlayhead(ctx, face.width / 2, face.height, weight);
    paintSheet(stripCtx, sheet.current, ink, seconds, length, strip.width, strip.height, weight);

    ticks.current += 1;
    const slow = ticks.current % TEXT_EVERY === 0;
    if (slow) rail.current?.setAttribute("aria-valuenow", String(Math.round(seconds)));
    const needle = gauge.current;
    const anchor = mark.current;
    if (!needle) return;
    if (!grid || anchor === null || !twin.current.live) {
      needle.style.setProperty("--dj-phase", "0");
      return;
    }
    const other = twin.current;
    const there = other.paused
      ? other.position
      : other.position + (performance.now() - other.at) / 1000;
    const gap = phaseDelta(
      beatPhase(seconds, grid.period, tile.current.origin),
      beatPhase(there, grid.period, anchor),
    );
    needle.style.setProperty("--dj-phase", gap.toFixed(4));
    if (slow && drift.current) {
      const offset = Math.round(gap * grid.period * 1000);
      drift.current.textContent = `${offset > 0 ? "+" : ""}${offset} ms`;
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      paint();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [paint]);

  const bound = useCallback((seconds: number) => Math.max(0, Math.min(total.current, seconds)), []);

  const pushSeek = useCallback((seconds: number, force: boolean) => {
    const last = scrub.current;
    const now = performance.now();
    if (Math.abs(seconds - last.value) < 0.01) return;
    if (!force && now - last.at < SEEK_MS) return;
    scrub.current = { at: now, value: seconds };
    sendDeckCommand({ kind: "seek", seconds });
  }, []);

  const land = useCallback(() => {
    const active = haul.current !== null || rails.current !== null;
    haul.current = null;
    rails.current = null;
    setHauling(false);
    const next = scroll.current.held;
    if (!active || next === null) return;
    settleScroll(scroll.current, next, performance.now());
    pushSeek(next, true);
  }, [pushSeek]);

  const railSeconds = useCallback(
    (clientX: number) => {
      const strip = rails.current;
      if (!strip) return 0;
      return bound(((clientX - strip.left) / strip.width) * total.current);
    },
    [bound],
  );

  const anchorTwin = useCallback(() => {
    const other = twin.current;
    if (!other.live) return;
    mark.current = other.paused
      ? other.position
      : other.position + (performance.now() - other.at) / 1000;
    ticks.current = TEXT_EVERY - 1;
    setAnchored(true);
  }, []);

  const grid = view?.grid ?? null;
  const strong = grid && grid.confidence >= GRID_MIN_CONFIDENCE ? grid : null;
  const note = !view
    ? ""
    : view.failed
      ? t("dj.wave.unavailable")
      : view.ready < 0.999
        ? `${t("dj.wave.reading")} ${Math.round(view.ready * 100)}%`
        : strong
          ? `${strong.bpm.toFixed(1)} ${t("dj.bpm")}`
          : t("dj.wave.noGrid");
  const measuring = Boolean(strong) && anchored && twinLive;

  return (
    <section className="dj-wave" data-size={size} ref={shell}>
      <div className="dj-bay-head">
        <span>{t("dj.wave.title")}</span>
        <span className="dj-bay-note" data-bad={view?.failed ? "" : undefined}>
          {note}
        </span>
      </div>
      <canvas
        className="dj-wave-zoom"
        ref={zoom}
        data-haul={hauling ? "" : undefined}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (event.button !== 0 || !(total.current > 0)) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (box.width <= 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const span = wide.current ? WIDE_SECONDS : TIGHT_SECONDS;
          const at = scroll.current.shown;
          haul.current = { x: event.clientX, at, per: span / box.width };
          scrub.current = { at: 0, value: at };
          holdScroll(scroll.current, at);
          setHauling(true);
        }}
        onPointerMove={(event) => {
          const grip = haul.current;
          if (!grip) return;
          const next = bound(grip.at - (event.clientX - grip.x) * grip.per);
          holdScroll(scroll.current, next);
          pushSeek(next, false);
        }}
        onPointerUp={land}
        onPointerCancel={land}
        onLostPointerCapture={land}
      />
      <div
        className="dj-wave-seek"
        ref={rail}
        role="slider"
        tabIndex={0}
        aria-label={t("dj.wave.seek")}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        onPointerDown={(event) => {
          if (event.button !== 0 || !(total.current > 0)) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (box.width <= 0) return;
          rails.current = { left: box.left, width: box.width };
          scrub.current = { at: 0, value: Number.NaN };
          event.currentTarget.setPointerCapture(event.pointerId);
          const next = railSeconds(event.clientX);
          holdScroll(scroll.current, next);
          pushSeek(next, true);
        }}
        onPointerMove={(event) => {
          if (!rails.current) return;
          const next = railSeconds(event.clientX);
          holdScroll(scroll.current, next);
          pushSeek(next, false);
        }}
        onPointerUp={land}
        onPointerCancel={land}
        onLostPointerCapture={land}
        onKeyDown={(event) => {
          const back = event.key === "ArrowLeft";
          if (!back && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = bound(scroll.current.shown + (back ? -NUDGE_SECONDS : NUDGE_SECONDS));
          scrub.current = { at: 0, value: Number.NaN };
          settleScroll(scroll.current, next, performance.now());
          pushSeek(next, true);
        }}
      >
        <canvas className="dj-wave-strip" ref={board} aria-hidden="true" />
      </div>
      {size === "full" && (
        <div className="dj-wave-phase">
          <span className="dj-wave-phase-label">{t("dj.wave.phase")}</span>
          <span className="dj-wave-phase-meter" aria-hidden="true">
            <i className="dj-wave-phase-centre" />
            <span className="dj-wave-phase-needle" ref={gauge} />
          </span>
          <em className="dj-wave-phase-drift" ref={drift} hidden={!measuring} />
          <small className="dj-wave-phase-hint" hidden={measuring}>
            {strong ? t("dj.wave.markHint") : t("dj.wave.noGrid")}
          </small>
          <Hardware
            tone="cyan"
            lit={anchored}
            disabled={!twinLive || !strong}
            label={t("dj.wave.markB")}
            onClick={anchorTwin}
          />
        </div>
      )}
    </section>
  );
}
