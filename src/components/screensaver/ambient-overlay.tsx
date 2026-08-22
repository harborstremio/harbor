import { useEffect, useRef, useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";

export type AmbientItem = { bg: string; title: string; sub: string };

const DEEP_IDLE_MS = 6 * 60_000;
const ROTATE_MS = 13_000;
const FADE_MS = 1_600;

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    time: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    date: now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  };
}

function AmbientSlide({
  src,
  leaving,
  reduce,
}: {
  src: string;
  leaving: boolean;
  reduce: boolean;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        opacity: shown && !leaving ? 1 : 0,
        transform: reduce ? undefined : shown ? "scale(1.1)" : "scale(1.03)",
        transformOrigin: "50% 42%",
        transition: reduce
          ? `opacity ${FADE_MS}ms ease-out`
          : `opacity ${FADE_MS}ms ease-out, transform 16000ms linear`,
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
}: {
  items: AmbientItem[];
  reduce: boolean;
  visible: boolean;
  onDismiss: () => void;
}) {
  const { time, date } = useClock();
  const [deepIdle, setDeepIdle] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(() =>
    items[0] ? [{ key: 0, item: items[0] }] : [],
  );
  const nextKey = useRef(1);
  const index = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeepIdle(true), DEEP_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (deepIdle || items.length < 2) return;
    const timer = window.setInterval(() => {
      index.current = (index.current + 1) % items.length;
      const item = items[index.current];
      setLayers((current) => [...current.slice(-1), { key: nextKey.current++, item }]);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [deepIdle, items]);

  useEffect(() => {
    if (layers.length < 2) return;
    const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), FADE_MS + 500);
    return () => window.clearTimeout(timer);
  }, [layers]);

  const renderedLayers = deepIdle ? [] : layers;
  const current = renderedLayers.at(-1)?.item ?? items[0];

  return (
    <div
      role="presentation"
      aria-hidden
      onPointerDown={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      className="fixed inset-0 z-[200] cursor-none select-none bg-black"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${visible ? 900 : 420}ms ease-out`,
        willChange: "opacity",
      }}
    >
      {renderedLayers.map((layer, layerIndex) => (
        <AmbientSlide
          key={layer.key}
          src={layer.item.bg}
          leaving={layerIndex !== renderedLayers.length - 1}
          reduce={reduce}
        />
      ))}

      {deepIdle ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(125% 90% at 50% 26%, oklch(0.22 0.03 262 / 0.6), oklch(0.06 0.01 260) 72%)",
          }}
        />
      ) : (
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

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start p-10">
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
        {!deepIdle && current && (
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
