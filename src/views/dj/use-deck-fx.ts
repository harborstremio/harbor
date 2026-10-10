import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beatMs,
  clearMusicFx,
  divisionLabel,
  FX_DIVISIONS,
  FX_KINDS,
  FX_OFF,
  getMusicFx,
  setMusicFx,
  type MusicFx,
} from "@/lib/music/fx";
import { ReleaseFx, type ReleaseKind } from "./release-fx";

const FLUSH_MS = 90;
const PRIME_MS = 3500;

export function useDeckFx({
  trackKey,
  readPosition,
  bpm,
  armed,
}: {
  trackKey: string;
  readPosition: () => number;
  bpm: number | null;
  armed: boolean;
}) {
  const [fx, remember] = useState<MusicFx>(FX_OFF);
  const [running, setRunning] = useState<ReleaseKind | null>(null);
  const [ready, setReady] = useState(false);
  const rig = useRef<ReleaseFx | null>(null);
  const timer = useRef(0);
  const pending = useRef<MusicFx | null>(null);
  const latest = useRef(fx);
  latest.current = fx;
  const live = useRef(readPosition);
  live.current = readPosition;
  const tempo = useRef(120);
  tempo.current = bpm && bpm > 0 ? bpm : 120;

  const engine = useCallback(() => {
    if (!rig.current) rig.current = new ReleaseFx();
    return rig.current;
  }, []);

  useEffect(() => {
    void getMusicFx().then((current) => remember(current));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = 0;
      pending.current = null;
      if (latest.current.kind !== "off") void clearMusicFx().catch(() => {});
      rig.current?.dispose();
      rig.current = null;
    };
  }, []);

  useEffect(() => {
    const fxRig = engine();
    fxRig.reset(trackKey);
    setReady(false);
    if (!armed || !trackKey) return;
    let alive = true;
    const tick = () => {
      void fxRig.prime(live.current()).then((ok) => {
        if (alive && ok) setReady(true);
      });
    };
    tick();
    const poll = window.setInterval(tick, PRIME_MS);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [armed, engine, trackKey]);

  const push = useCallback((next: MusicFx) => {
    remember(next);
    pending.current = next;
    if (timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      const batch = pending.current;
      pending.current = null;
      if (!batch) return;
      const call = batch.kind === "off" ? clearMusicFx() : setMusicFx(batch);
      void call.catch(() => {});
    }, FLUSH_MS);
  }, []);

  const adjust = useCallback(
    (patch: Partial<MusicFx>) => push({ ...latest.current, ...patch, bpm: tempo.current }),
    [push],
  );

  useEffect(() => {
    if (latest.current.kind === "off") return;
    push({ ...latest.current, bpm: tempo.current });
  }, [bpm, push]);

  const release = useCallback(
    (kind: ReleaseKind) => {
      const fxRig = engine();
      if (fxRig.busy) return;
      setRunning(kind);
      void fxRig
        .run(kind, live.current(), beatMs(tempo.current, latest.current.beats))
        .catch(() => false)
        .then(() => setRunning(null));
    },
    [engine],
  );

  const divisions = useMemo(
    () => FX_DIVISIONS.map((beats) => ({ beats, label: divisionLabel(beats) })),
    [],
  );

  return { fx, adjust, release, running, ready, divisions, kinds: FX_KINDS };
}
