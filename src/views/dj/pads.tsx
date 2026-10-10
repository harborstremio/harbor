import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Knob } from "./controls";
import {
  MAX_SAMPLE_BYTES,
  readSamples,
  subscribeSamples,
  writeSamples,
  type DeckSample,
} from "./deck-store";

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

export function SamplePads({ gain, onGain }: { gain: number; onGain: (gain: number) => void }) {
  const t = useT();
  const [pads, setPads] = useState<Record<string, DeckSample>>({});
  const [firing, setFiring] = useState<number | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const buffers = useRef<Record<string, AudioBuffer>>({});
  const voices = useRef<Record<string, AudioBufferSourceNode>>({});
  const picking = useRef<number>(0);
  const input = useRef<HTMLInputElement>(null);
  const level = useRef(gain);
  level.current = gain;
  const loaded = useRef(pads);
  loaded.current = pads;

  useEffect(() => {
    let live = true;
    void readSamples().then((saved) => {
      if (live && saved) setPads(saved);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeSamples((next) => {
        for (const slot of SLOTS) {
          if (loaded.current[slot]?.blob !== next[slot]?.blob) delete buffers.current[slot];
        }
        setPads({ ...next });
      }),
    [],
  );

  const audio = useCallback(() => {
    if (!context.current) context.current = new AudioContext();
    void context.current.resume().catch(() => {});
    return context.current;
  }, []);

  const decode = useCallback(
    async (slot: number, sample: DeckSample) => {
      const cached = buffers.current[slot];
      if (cached) return cached;
      const bytes = await sample.blob.arrayBuffer();
      const buffer = await audio().decodeAudioData(bytes);
      buffers.current[slot] = buffer;
      return buffer;
    },
    [audio],
  );

  const fire = useCallback(
    (slot: number) => {
      const sample = pads[slot];
      if (!sample) return;
      setFiring(slot);
      window.setTimeout(() => setFiring((current) => (current === slot ? null : current)), 160);
      void decode(slot, sample)
        .then((buffer) => {
          const ctx = audio();
          voices.current[slot]?.stop();
          const source = ctx.createBufferSource();
          const volume = ctx.createGain();
          volume.gain.value = level.current;
          source.buffer = buffer;
          source.connect(volume).connect(ctx.destination);
          source.start();
          voices.current[slot] = source;
          source.onended = () => {
            if (voices.current[slot] === source) delete voices.current[slot];
          };
        })
        .catch(() => {});
    },
    [audio, decode, pads],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const slot = SLOTS.find((index) => String(index + 1) === event.key);
      if (slot === undefined) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      fire(slot);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  const load = (slot: number) => {
    picking.current = slot;
    setTooBig(false);
    input.current?.click();
  };

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SAMPLE_BYTES) {
      setTooBig(true);
      return;
    }
    const slot = picking.current;
    const next = {
      ...pads,
      [slot]: { name: file.name.replace(/\.[^.]+$/, ""), blob: file.slice() },
    };
    delete buffers.current[slot];
    setPads(next);
    writeSamples(next);
  };

  const clear = (slot: number) => {
    const next = { ...pads };
    delete next[slot];
    delete buffers.current[slot];
    setPads(next);
    writeSamples(next);
  };

  return (
    <div className="dj-pad-samples">
      {tooBig && (
        <span className="dj-bay-note" data-bad="">
          {t("dj.samples.tooBig")}
        </span>
      )}
      <div className="dj-bay-knob">
        <Knob
          label={t("dj.samples.gain")}
          value={gain}
          min={0}
          max={1.4}
          readout={`${Math.round(gain * 100)}%`}
          onChange={onGain}
          onReset={() => onGain(0.85)}
          tone="cyan"
        />
        <div className="dj-samples">
          {SLOTS.map((slot) => {
            const sample = pads[slot];
            return (
              <div
                key={slot}
                className="dj-sample"
                data-deck-pad={slot}
                data-loaded={sample ? "" : undefined}
              >
                <button
                  type="button"
                  className="dj-sample-face"
                  data-firing={firing === slot || undefined}
                  onPointerDown={() => (sample ? fire(slot) : load(slot))}
                  aria-label={sample ? sample.name : t("dj.samples.empty")}
                >
                  <span className="dj-sample-key">{slot + 1}</span>
                  {sample ? (
                    <span className="dj-sample-name">{sample.name}</span>
                  ) : (
                    <Plus size={16} aria-hidden="true" />
                  )}
                </button>
                {sample && (
                  <button
                    type="button"
                    className="dj-sample-clear"
                    onClick={() => clear(slot)}
                    aria-label={t("dj.samples.clear")}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
