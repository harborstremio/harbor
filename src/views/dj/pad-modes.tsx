import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { sendDeckCommand } from "@/lib/music/deck-sync";
import { Hardware } from "./controls";
import { preciseClock } from "./deck-state";
import { readCues, writeCues } from "./deck-store";
import { SamplePads } from "./pads";

type PadMode = "cue" | "roll" | "jump" | "sampler";

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];
const ROLL_BEATS = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4];
const ROLL_LABELS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1", "2", "4"];
const ROLL_SECONDS = [0.03, 0.06, 0.13, 0.25, 0.5, 1, 2, 4];
const JUMP_STEPS = [-8, -4, -2, -1, 1, 2, 4, 8];
const TRIPLET = 2 / 3;
const FLASH_MS = 150;
const TAIL = 0.1;

const MODES: { id: PadMode; key: string }[] = [
  { id: "cue", key: "dj.pads.cue" },
  { id: "roll", key: "dj.pads.roll" },
  { id: "jump", key: "dj.pads.jump" },
  { id: "sampler", key: "dj.pads.sampler" },
];

function seconds(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function Pad({
  tone,
  lit,
  label,
  onClick,
  onContextMenu,
  onPress,
  onRelease,
  children,
}: {
  tone: "amber" | "cyan" | "green" | "steel";
  lit?: boolean;
  label: string;
  onClick?: () => void;
  onContextMenu?: () => void;
  onPress?: () => void;
  onRelease?: () => void;
  children: ReactNode;
}) {
  const armed = useRef(false);
  const latest = useRef(onRelease);
  latest.current = onRelease;

  useEffect(() => {
    const up = () => {
      if (!armed.current) return;
      armed.current = false;
      latest.current?.();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      up();
    };
  }, []);

  return (
    <span
      className="dj-pad"
      onPointerDown={(event) => {
        if (event.button !== 0 || !onPress) return;
        armed.current = true;
        onPress();
      }}
    >
      <Hardware tone={tone} lit={lit} label={label} onClick={onClick} onContextMenu={onContextMenu}>
        {children}
      </Hardware>
    </span>
  );
}

export function PadDeck({
  trackId,
  duration,
  playing,
  speed,
  bpm,
  readPosition,
  gain,
  onGain,
}: {
  trackId: string;
  duration: number;
  playing: boolean;
  speed: number;
  bpm: number | null;
  readPosition: () => number;
  gain: number;
  onGain: (gain: number) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<PadMode>("cue");
  const [cues, setCues] = useState<number[]>([]);
  const [triplet, setTriplet] = useState(false);
  const [rolling, setRolling] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const roll = useRef<{ from: number; at: number } | null>(null);
  const rollKey = useRef<string | null>(null);
  const beat = bpm && bpm > 0 ? 60 / bpm : null;

  useEffect(() => {
    if (!trackId) {
      setCues([]);
      return;
    }
    let live = true;
    void readCues(trackId).then((saved) => {
      if (live) setCues(saved ?? []);
    });
    return () => {
      live = false;
    };
  }, [trackId]);

  useEffect(
    () => () => {
      if (!roll.current) return;
      roll.current = null;
      sendDeckCommand({ kind: "loop", start: null, end: null });
    },
    [],
  );

  const land = useCallback(
    (at: number) => {
      const capped = duration > 0 ? Math.min(duration - TAIL, at) : at;
      sendDeckCommand({ kind: "seek", seconds: Math.max(0, capped) });
    },
    [duration],
  );

  const hitCue = useCallback(
    (slot: number) => {
      const at = cues[slot];
      if (typeof at === "number") {
        sendDeckCommand({ kind: "seek", seconds: at });
        return;
      }
      const next = [...cues];
      next[slot] = readPosition();
      setCues(next);
      if (trackId) writeCues(trackId, next);
    },
    [cues, readPosition, trackId],
  );

  const dropCue = useCallback(
    (slot: number) => {
      if (typeof cues[slot] !== "number") return;
      const next = [...cues];
      delete next[slot];
      setCues(next);
      if (trackId) writeCues(trackId, next);
    },
    [cues, trackId],
  );

  const startRoll = useCallback(
    (slot: number) => {
      if (roll.current) return;
      const base = beat ? ROLL_BEATS[slot] * beat : ROLL_SECONDS[slot];
      const span = base * (triplet ? TRIPLET : 1);
      const from = readPosition();
      const to = duration > 0 ? Math.min(duration, from + span) : from + span;
      if (to <= from + 0.01) return;
      roll.current = { from, at: performance.now() };
      setRolling(slot);
      sendDeckCommand({ kind: "loop", start: from, end: to });
    },
    [beat, duration, readPosition, triplet],
  );

  const endRoll = useCallback(() => {
    const held = roll.current;
    roll.current = null;
    rollKey.current = null;
    setRolling(null);
    if (!held) return;
    sendDeckCommand({ kind: "loop", start: null, end: null });
    const moved = playing ? ((performance.now() - held.at) / 1000) * Math.max(speed, 0.05) : 0;
    land(held.from + moved);
  }, [land, playing, speed]);

  const hitJump = useCallback(
    (slot: number) => {
      const step = JUMP_STEPS[slot];
      setFlash(slot);
      window.setTimeout(() => setFlash((current) => (current === slot ? null : current)), FLASH_MS);
      land(readPosition() + step * (beat ?? 1));
    },
    [beat, land, readPosition],
  );

  useEffect(() => {
    if (mode === "roll" || !roll.current) return;
    endRoll();
  }, [endRoll, mode]);

  useEffect(() => {
    if (mode === "sampler") return;
    const slotFor = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return -1;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return -1;
      return SLOTS.find((slot) => String(slot + 1) === event.key) ?? -1;
    };
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const slot = slotFor(event);
      if (slot < 0) return;
      if (mode === "cue") hitCue(slot);
      else if (mode === "jump") hitJump(slot);
      else {
        rollKey.current = event.code || event.key;
        startRoll(slot);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (rollKey.current === null || (event.code || event.key) !== rollKey.current) return;
      endRoll();
    };
    const bail = () => {
      if (roll.current || rollKey.current !== null) endRoll();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", bail);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", bail);
    };
  }, [endRoll, hitCue, hitJump, mode, startRoll]);

  const note = () => {
    if (mode === "sampler") return t("dj.samples.hint");
    if (mode === "cue") return t("dj.cues.hint");
    if (!beat) return t("dj.pads.noBpm");
    return t(mode === "roll" ? "dj.pads.rollHint" : "dj.pads.jumpHint");
  };

  return (
    <div className="dj-bay dj-pads">
      <div className="dj-bay-head">
        <span>{t("dj.pads.title")}</span>
        <span className="dj-bay-note">{note()}</span>
      </div>
      <div className="dj-bay-row dj-pad-modes" role="group" aria-label={t("dj.pads.mode")}>
        {MODES.map((entry) => (
          <Hardware
            key={entry.id}
            tone={entry.id === mode ? "accent" : "steel"}
            lit={entry.id === mode}
            label={t(entry.key)}
            onClick={() => setMode(entry.id)}
          />
        ))}
        {mode === "roll" && (
          <span className="dj-pad-triplet">
            <Hardware
              tone="cyan"
              lit={triplet}
              label={t("dj.pads.triplet")}
              onClick={() => setTriplet(!triplet)}
            />
          </span>
        )}
      </div>
      {mode === "sampler" ? (
        <SamplePads gain={gain} onGain={onGain} />
      ) : (
        <div className="dj-pad-grid" data-triplet={mode === "roll" && triplet ? "" : undefined}>
          {SLOTS.map((slot) => {
            if (mode === "cue") {
              const at = cues[slot];
              const set = typeof at === "number";
              return (
                <Pad
                  key={slot}
                  tone={set ? "amber" : "steel"}
                  lit={set}
                  label={`${t("dj.cues.title")} ${slot + 1}`}
                  onClick={() => hitCue(slot)}
                  onContextMenu={() => dropCue(slot)}
                >
                  <b>{slot + 1}</b>
                  <small>{set ? preciseClock(at) : t("dj.cues.empty")}</small>
                </Pad>
              );
            }
            if (mode === "roll") {
              const label = beat ? ROLL_LABELS[slot] : seconds(ROLL_SECONDS[slot]);
              return (
                <Pad
                  key={slot}
                  tone="cyan"
                  lit={rolling === slot}
                  label={`${t("dj.pads.roll")} ${label}`}
                  onPress={() => startRoll(slot)}
                  onRelease={endRoll}
                >
                  <b>{label}</b>
                </Pad>
              );
            }
            const step = JUMP_STEPS[slot];
            const label = `${step > 0 ? "+" : ""}${step}`;
            return (
              <Pad
                key={slot}
                tone="green"
                lit={flash === slot}
                label={`${t("dj.pads.jump")} ${label}`}
                onClick={() => hitJump(slot)}
              >
                <b>{label}</b>
              </Pad>
            );
          })}
        </div>
      )}
    </div>
  );
}
