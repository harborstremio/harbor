import { useEffect, useRef, useState } from "react";
import { useMusicAppearance } from "@/lib/music/appearance";
import { MIKU_ARTWORK, type MikuArtworkSet } from "@/lib/music/miku-artwork";
import type { MikuModel } from "@/lib/music/miku-models";
import { acquireMusicMeter } from "@/lib/music/audio-meter";
import { createMikuDance, createMikuDanceMemory, MIKU_DANCE, MIKU_CLASSIC_MMD_DANCE } from "@/lib/music/miku-dance";
import { createMikuExpression } from "@/lib/music/miku-expression";
import { createMikuListeningPerformance } from "@/lib/music/miku-listening";
import { createMikuGroove, mikuFrame, mikuEnergy, MIKU_ATLAS, MIKU_TIMING } from "@/lib/music/miku-motion";
import type { MusicTrack } from "@/lib/music/types";
import type { MusicMeterStream } from "./music-dock-visualizer";
import "./music-miku-visualizer.css";

// Expanding Now playing or temporarily hiding the dock must not restart the
// repertoire at the first dance on every song.
const sessionDanceMemory = createMikuDanceMemory();

/* ANIMATION STORYBOARD
 *   idle      hands rest with quiet breathing/blinks; no paused audio analysis
 *   0–780ms   measured audio arrives → shoulders lead palms to the headphone cups
 *   listening bass/level envelope drives nods; hair follows with a softer response
 *   video     without an audio tap, a small relaxed nod keeps her listening
 *   drop      a sustained percussion lift earns a dance on the musical phrase
 *   breakdown finish the beat-aligned loop, then hands down and headphones
 *   16–20s    minimum listening break; a new strong section earns another dance
 *   silence   finish the visible gesture → rest the head → lower the hands
 *   reduced   static portrait; no animation loop or native meter acquired
 */
export function MikuArtwork({ className = "" }: { className?: string }) {
  const { mikuModel } = useMusicAppearance();
  return <img className={`music-miku-art ${className}`} src={MIKU_ARTWORK[mikuModel].portrait} alt="" aria-hidden="true" draggable={false} />;
}

export function MusicMikuVisualizer({ track, playing, concealed = false, stream = acquireMusicMeter }: {
  track: MusicTrack;
  playing: boolean;
  concealed?: boolean;
  stream?: MusicMeterStream;
}) {
  const { mikuModel } = useMusicAppearance();
  const [active, setActive] = useState<{ model: MikuModel; art: MikuArtworkSet } | null>(null);
  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const art = MIKU_ARTWORK[mikuModel];
    // Switch the complete pose set together; never put one model's eyes over
    // another model's face while its larger sprite sheet is loading.
    const load = () => {
      const images = [art.motion, art.eyes, art.idle].map(src => {
        const image = new Image(); image.src = src;
        return image.decode();
      });
      void Promise.all(images).then(() => {
        if (!disposed) setActive({ model: mikuModel, art });
      }).catch(() => {
        if (disposed) return;
        // Retain the visible pose while a temporary asset failure recovers.
        retry = setTimeout(load, Math.min(15000, 1000 * 2 ** failures));
        failures = Math.min(4, failures + 1);
      });
    };
    load();
    return () => { disposed = true; clearTimeout(retry); };
  }, [mikuModel]);
  const root = useRef<HTMLDivElement>(null);
  const danceMemory = useRef(sessionDanceMemory);
  const playingRef = useRef(playing);
  const refresh = useRef<(() => void) | undefined>(undefined);
  useEffect(() => { playingRef.current = playing; refresh.current?.(); }, [playing]);
  const trackId = track.id, connectorId = track.connectorId ?? null;
  const video = track.mediaKind === "video";
  const supported = connectorId !== "spotify" && !video;
  const identity = useRef({ trackId, connectorId });
  identity.current = { trackId, connectorId };
  useEffect(() => { refresh.current?.(); }, [trackId, connectorId]);
  useEffect(() => {
    const host = root.current;
    if (!host || !active) return;
    const danceSheets = active.art.dances;
    const repertoire = active.model === "retro" ? MIKU_CLASSIC_MMD_DANCE : MIKU_DANCE;
    const sprite = host.querySelector<HTMLElement>(".music-miku-sprite");
    const dancer = host.querySelector<HTMLElement>(".music-miku-dancer");
    const eyelids = host.querySelector<HTMLElement>(".music-miku-eyes");
    // Dataset writes still notify observers when the value is unchanged.
    // Paint only changed states, especially on high-refresh displays.
    const setState = (key: string, value: string) => {
      if (host.dataset[key] !== value) host.dataset[key] = value;
    };
    let release: (() => void) | undefined, frame = 0, disposed = false;
    let target = 0, energy = 0, lift = 0, bob = 0, sway = 0;
    let releaseBob = 0, releaseSway = 0;
    let settling = 0, settleBob = 0, settleSway = 0;
    let sampledAt = 0, audibleAt = 0, previous = 0, painted = -1;
    let videoPlaying = false, videoTime = 0;
    const groove = createMikuGroove();
    const listeningPerformance = createMikuListeningPerformance();
    let measuredTrack = identity.current;
    const reconcileTrack = () => {
      const next = identity.current;
      if (next.trackId === measuredTrack.trackId && next.connectorId === measuredTrack.connectorId) return;
      measuredTrack = next;
      // Keep the visible performance alive across track changes. Reset only
      // the audio clock; the existing gesture can finish and lower its hands.
      groove.reset(true); listeningPerformance.reset(true); target = energy = 0; sampledAt = audibleAt = 0;
      dance.selectTrack(JSON.stringify([next.connectorId, next.trackId]));
    };
    const dance = createMikuDance(danceMemory.current, repertoire);
    dance.selectTrack(JSON.stringify([measuredTrack.connectorId, measuredTrack.trackId]));
    const expression = createMikuExpression();
    let eyes = expression.advance(0, false);
    let danceState = dance.advance(0, { beat: 0, locked: false, excitement: 0 }, false, false);
    const loaded = new Set<number>();
    const sheets = new Map<number, HTMLImageElement>();
    const retryDance = new Map<number, { at: number; failures: number }>();
    const loadDance = () => {
      const kind = dance.next;
      if (sheets.has(kind)) return;
      const failed = retryDance.get(kind);
      if (failed && performance.now() < failed.at) return;
      const sheet = new Image();
      sheets.set(kind, sheet);
      sheet.src = danceSheets[kind];
      void sheet.decode().then(() => {
        if (!disposed) { loaded.add(kind); retryDance.delete(kind); }
      }).catch(() => {
        if (disposed) return;
        sheets.delete(kind);
        const failures = Math.min(5, (failed?.failures ?? 0) + 1);
        retryDance.set(kind, { failures, at: performance.now() + Math.min(15000, 1000 * 2 ** (failures - 1)) });
      });
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      const preparing = danceState.stage === "preparing";
      const index = mikuFrame(lift,
        (preparing ? releaseBob : bob) * danceState.listening,
        (preparing ? releaseSway : sway) * danceState.listening);
      if (sprite && painted !== index) {
        painted = index;
        const x = index % MIKU_ATLAS.columns, y = Math.floor(index / MIKU_ATLAS.columns);
        sprite.style.backgroundPosition = `${x * 100 / (MIKU_ATLAS.columns - 1)}% ${y * 100 / (MIKU_ATLAS.rows - 1)}%`;
        if (eyelids) eyelids.style.backgroundPosition = sprite.style.backgroundPosition;
        setState("frame", String(index));
      }
      if (sprite) sprite.style.opacity = String(1 - danceState.opacity);
      if (eyelids) eyelids.style.opacity = danceState.opacity === 0 ? String(eyes.closure) : "0";
      setState("eyes", eyes.closure > .5 ? "closed" : "open");
      setState("expression", eyes.kind);
      if (dancer) {
        dancer.style.opacity = String(danceState.opacity);
        if (danceState.opacity > 0) {
          const x = danceState.frame % MIKU_DANCE.columns, y = Math.floor(danceState.frame / MIKU_DANCE.columns);
          const rows = repertoire.rows[danceState.kind];
          // Wider choreography keeps the same height and centered headset
          // endpoint; extra transparent gutters leave room for hands and hair.
          const width = MIKU_DANCE.frameWidths[danceState.kind] / 288;
          dancer.style.width = `${width * 100}%`;
          dancer.style.left = `${(1 - width) * 50}%`;
          dancer.style.backgroundImage = `url(${danceSheets[danceState.kind]})`;
          dancer.style.backgroundSize = `${MIKU_DANCE.columns * 100}% ${rows * 100}%`;
          dancer.style.backgroundPosition = `${x * 100 / (MIKU_DANCE.columns - 1)}% ${y * 100 / (rows - 1)}%`;
        } else dancer.style.backgroundImage = "none";
      }
      setState("dance", danceState.stage);
      setState("danceKind", String(danceState.kind));
      setState("danceFrame", String(danceState.frame));
      setState("stage", danceState.opacity > 0 ? "dancing" : lift < 0.01 ? "idle" : lift < 0.96 ? "reaching" : "listening");
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed) return;
      const elapsed = previous ? now - previous : 16;
      // Match the dance handoff's bounded wall-time budget. A 10fps render
      // must not stretch a 780ms headphone reach into a slow-motion gesture.
      const dt = Math.min(250, elapsed);
      previous = now;
      if (now - sampledAt > MIKU_TIMING.meterGrace) target = 0;
      energy += (target - energy) * Math.min(1, dt / (target > energy ? 75 : 210));
      const driving = !!release && target > 0.04;
      const pulse = groove.advance(elapsed, driving, now);
      if (video) {
        // A quiet listening gesture, independent of the beat detector. Leave
        // the last pose in place on pause so the normal head release can settle it.
        if (videoPlaying && lift >= 0.99) {
          videoTime = (videoTime + elapsed) % 1600;
          const nod = (1 - Math.cos(videoTime / 1600 * Math.PI * 2)) * 0.16;
          bob += (nod - bob) * (1 - Math.exp(-elapsed / 90));
        }
        sway = 0;
      } else ({ bob, sway } = pulse);
      if (!video) {
        const reaction = listeningPerformance.advance(elapsed, pulse,
          driving && lift >= .99 && danceState.stage === "listening");
        bob = reaction.bob; sway = reaction.sway;
        setState("reaction", reaction.reaction ?? "none");
      }
      // Missing analysis is different from a measured silence. Keep the
      // hands in place briefly during an IPC stall, while the nod eases off.
      // Explicit pause, buffering and silent samples still release normally.
      const waitingForMeter = now - sampledAt > MIKU_TIMING.stale;
      const holding = videoPlaying || (!!release && audibleAt > 0 && now - audibleAt <
        (waitingForMeter ? MIKU_TIMING.meterGrace : MIKU_TIMING.silence));
      const wasPreparing = danceState.stage === "preparing";
      danceState = dance.advance(elapsed, pulse, holding, loaded.has(dance.next));
      if (danceState.stage === "preparing" && !wasPreparing) {
        // Finish the outgoing nod instead of chasing each new kick while
        // the hands are preparing to release their headphone contact.
        releaseBob = bob; releaseSway = sway;
      }
      if (driving) loadDance();
      if (danceState.resting) {
        // The authored return has already reached arms-down. Hand over the
        // matching rest pose, never a hidden, fully raised headphone sprite.
        lift = 0; settling = 0; bob = sway = 0;
      } else if (danceState.opacity > 0 || danceState.stage === "preparing") {
        lift = 1; settling = 0;
      } else if (!holding && lift >= 0.99 && settling < MIKU_TIMING.headSettle) {
        if (settling === 0) { settleBob = bob; settleSway = sway; }
        settling = Math.min(MIKU_TIMING.headSettle, settling + dt);
        const t = settling / MIKU_TIMING.headSettle;
        const weight = 1 - t * t * t * (t * (t * 6 - 15) + 10);
        bob = settleBob * weight; sway = settleSway * weight;
      } else {
        if (holding) settling = 0;
        lift = Math.max(0, Math.min(1, lift + (holding ? dt / MIKU_TIMING.lift : -dt / MIKU_TIMING.settle)));
      }
      eyes = expression.advance(elapsed, holding && lift > 0.98 && danceState.stage === "listening");
      paint();
      if (videoPlaying || target > 0.002 || lift > 0 || energy > 0.002 || danceState.opacity > 0) frame = requestAnimationFrame(tick);
      else { energy = 0; bob = 0; sway = 0; videoTime = 0; groove.reset(); paint(); }
    };
    const start = () => { if (!frame) { previous = 0; frame = requestAnimationFrame(tick); } };
    const visible = () => {
      reconcileTrack();
      setState("ambient", String(!document.hidden && !motion.matches && !!host.offsetWidth));
      videoPlaying = video && playingRef.current && !document.hidden && !motion.matches && !!host.offsetWidth;
      if (!playingRef.current || (!supported && !video) || document.hidden || motion.matches || !host.offsetWidth) {
        if (release && !playingRef.current) groove.suspend();
        release?.(); release = undefined; target = 0; audibleAt = 0;
        if (motion.matches || document.hidden || !host.offsetWidth) {
          cancelAnimationFrame(frame); frame = 0; lift = 0; energy = 0; bob = sway = videoTime = 0; groove.reset(); dance.reset();
          expression.reset(); listeningPerformance.reset(); eyes = expression.advance(0, false);
          danceState = dance.advance(0, { beat: 0, locked: false, excitement: 0 }, false, false); paint();
        } else start();
      } else if (videoPlaying) {
        start();
      } else if (!release) {
        release = stream(state => {
          reconcileTrack();
          const { trackId, connectorId } = identity.current;
          if (state.status !== "ready" || state.data?.trackId !== trackId ||
              (state.data.connectorId ?? null) !== connectorId) return;
          const now = performance.now();
          target = mikuEnergy(state, trackId, connectorId); sampledAt = now;
          if (target > 0.04) audibleAt = now;
          groove.sample(state, trackId, connectorId, now);
          if (target > 0.002 || lift > 0 || energy > 0.002) start();
        });
      }
    };
    refresh.current = visible;
    paint(); visible();
    const size = new ResizeObserver(visible); size.observe(host);
    document.addEventListener("visibilitychange", visible); motion.addEventListener("change", visible);
    return () => {
      disposed = true; release?.(); cancelAnimationFrame(frame); size.disconnect();
      for (const sheet of sheets.values()) sheet.onload = null;
      refresh.current = undefined;
      document.removeEventListener("visibilitychange", visible); motion.removeEventListener("change", visible);
      energy = 0; lift = 0; bob = sway = 0; groove.reset(); dance.reset();
      expression.reset(); eyes = expression.advance(0, false);
      danceState = dance.advance(0, { beat: 0, locked: false, excitement: 0 }, false, false); paint();
    };
  }, [supported, video, stream, active]);
  if (!active) return <div className="music-miku-perch" data-concealed={concealed || undefined} aria-hidden="true">
    <div className="music-miku-reveal"><MikuArtwork /></div>
  </div>;
  const { art } = active;
  return <div ref={root} data-model={active.model} className="music-miku-perch" data-concealed={concealed || undefined} data-stage="idle" aria-hidden="true">
    <div className="music-miku-reveal">
      <div className="music-miku-art music-miku-sprite" style={{ backgroundImage: `url(${art.motion})`, backgroundSize: `${MIKU_ATLAS.columns * 100}% ${MIKU_ATLAS.rows * 100}%` }} />
      <div className="music-miku-eyes" style={{ backgroundImage: `url(${art.eyes})`, backgroundSize: `${MIKU_ATLAS.columns * 100}% ${MIKU_ATLAS.rows * 100}%` }} />
      <div className="music-miku-dancer" />
      <div className="music-miku-idle" style={{ backgroundImage: `url(${art.idle})` }} />
    </div>
  </div>;
}
