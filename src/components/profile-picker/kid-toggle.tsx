import { useT } from "@/lib/i18n";
import { DEFAULT_KID, type KidConfig } from "@/lib/profiles";
import { useState } from "react";

const TOGGLE_DOODLES: { src: string; pos: string; flip?: boolean; hover?: boolean }[] = [
  { src: "lilwhale1", pos: "bottom-1 right-4 h-16", flip: true },
  { src: "lilorangestar2", pos: "right-24 top-3 h-7" },
];

export function KidToggle({
  value,
  onChange,
}: {
  value: KidConfig | null;
  onChange: (next: KidConfig | null) => void;
}) {
  const t = useT();
  const on = value != null;
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${
        on ? "border-[#6bc5ca]/60 shadow-[0_14px_36px_-14px_rgba(15,82,119,0.7)]" : "border-edge-soft bg-canvas/40"
      }`}
    >
      {on && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#42aecb] via-[#1f7fa6] to-[#0d4f73]" />
      )}
      {on && <BubbleField />}
      {TOGGLE_DOODLES.map((d, i) => {
        const visible = on || (d.hover && hover);
        return (
          <img
            key={d.src}
            src={`/kids/doodles/${d.src}.png`}
            alt=""
            draggable={false}
            className={`pointer-events-none absolute ${d.pos} w-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out`}
            style={{
              transform: `${d.flip ? "scaleX(-1) " : ""}translateY(${visible ? "0" : "2.75rem"})`,
              opacity: visible ? 0.95 : 0,
              transitionDelay: visible ? `${i * 80}ms` : "0ms",
            }}
          />
        );
      })}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`font-display text-[16px] font-semibold ${on ? "text-white" : "text-ink"}`}>
            {t("Kids profile")}
          </span>
          <span className={`max-w-[320px] text-[12px] leading-snug ${on ? "text-white/85" : "text-ink-subtle"}`}>
            {t("A safe, simple space: kid-friendly titles, big art, one-tap play, and a watch-time limit.")}
          </span>
        </div>
        <Switch on={on} onClick={() => onChange(on ? null : DEFAULT_KID)} />
      </div>
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${
        on ? "bg-white/90" : "bg-ink/20"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full shadow transition-all duration-300 ${
          on ? "left-6 bg-[#0d4f73]" : "left-1 bg-ink/55"
        }`}
      />
    </button>
  );
}

const BUBBLES = [
  { left: 12, size: 7, delay: 0 },
  { left: 28, size: 5, delay: 1.1 },
  { left: 44, size: 9, delay: 0.5 },
  { left: 63, size: 6, delay: 1.7 },
  { left: 78, size: 8, delay: 0.9 },
  { left: 90, size: 5, delay: 2.1 },
];

function BubbleField() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="kid-bubble absolute bottom-2 rounded-full bg-white/40"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
