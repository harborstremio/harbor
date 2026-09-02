import { useEffect, useRef, useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";

export type AmbientItem = { bg: string; title: string; sub: string };

const DEEP_IDLE_MS = 6 * 60 * 1000;
const ROTATE_MS = 13000;
const FADE_MS = 1600;
const DRIFT_STEPS = 240;

function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return { time, date };
}

function AmbientSlide({ src, out, reduce }: { src: string; out: boolean; reduce: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  if (!src) return null;
  const visible = shown && !out;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        opacity: visible ? 1 : 0,
        transform: reduce ? undefined : shown ? "scale(1.1)" : "scale(1.03)",
        transformOrigin: "50% 42%",
        willChange: reduce ? undefined : "transform, opacity",
        transition: reduce
          ? `opacity ${FADE_MS}ms ease-out`
          : `opacity ${FADE_MS}ms ease-out, transform 16000ms steps(${DRIFT_STEPS}, end)`,
      }}
    />
  );
}

type Layer = { key: number; item: AmbientItem };

export function AmbientOverlay({
  items,
  reduce,
  visible,
  onDismiss,
  neverDeep,
}: {
  items: AmbientItem[];
  reduce: boolean;
  visible: boolean;
  onDismiss: () => void;
  neverDeep?: boolean;
}) {
  const { time, date } = useClock();
  const [deep, setDeep] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(() => (items[0] ? [{ key: 0, item: items[0] }] : []));
  const keyRef = useRef(1);
  const idxRef = useRef(0);

  // Deep idle blanks the art to a clock, which is right for a desktop window
  // left open all day and wrong for a TV: Big Picture opts out and keeps
  // cycling, because a black screen there reads as the app having died.
  useEffect(() => {
    if (neverDeep) return;
    const id = window.setTimeout(() => setDeep(true), DEEP_IDLE_MS);
    return () => window.clearTimeout(id);
  }, [neverDeep]);

  useEffect(() => {
    if (deep || items.length < 2) return;
    const id = window.setInterval(() => {
      idxRef.current = (idxRef.current + 1) % items.length;
      const next = items[idxRef.current];
      setLayers((prev) => [...prev.slice(-1), { key: keyRef.current++, item: next }]);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [items, deep]);

  useEffect(() => {
    if (layers.length < 2) return;
    const id = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), FADE_MS + 500);
    return () => window.clearTimeout(id);
  }, [layers]);

  useEffect(() => {
    if (deep) setLayers([]);
  }, [deep]);

  const current = layers.length ? layers[layers.length - 1].item : items[0];

  return (
    <div
      role="presentation"
      aria-hidden
      onPointerDown={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      className="fixed inset-0 z-[200] cursor-none select-none bg-black"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${visible ? 900 : 420}ms ease-out`,
        willChange: "opacity",
      }}
    >
      {layers.map((layer, i) => (
        <AmbientSlide key={layer.key} src={layer.item.bg} out={i !== layers.length - 1} reduce={reduce} />
      ))}

      {deep && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(125% 90% at 50% 26%, oklch(0.22 0.03 262 / 0.6), oklch(0.06 0.01 260) 72%)" }}
        />
      )}
      {!deep && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/45" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 26%, rgba(0,0,0,0.22) 52%, rgba(0,0,0,0) 78%)",
            }}
          />
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-10">
        <div className="flex items-center gap-2">
          <HarborMark className="h-7 w-7 shrink-0 text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]" />
          <span className="font-display text-[26px] font-semibold tracking-tight text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            Harbor
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-8 p-12">
        <div className="flex flex-col">
          <span className="text-[15px] font-medium uppercase tracking-[0.22em] text-white/60 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            {date}
          </span>
          <span className="mt-1 text-[92px] font-light leading-none tabular-nums text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.75)]">
            {time}
          </span>
        </div>
        {!deep && current && (
          <div className="mb-2 flex max-w-[46%] flex-col items-end text-end">
            {current.sub && (
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/65 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
                {current.sub}
              </span>
            )}
            <span className="mt-1 truncate text-[30px] font-semibold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]">
              {current.title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
