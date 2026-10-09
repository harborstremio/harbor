import { ArrowRight } from "lucide-react";
import { useRef } from "react";
import type { FeedItem } from "@/lib/feed";
import { useT } from "@/lib/i18n";
import { rpdbPoster } from "@/lib/providers/rpdb";
import { useSettings } from "@/lib/settings";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useView } from "@/lib/view";
import { artAtWidth } from "@/lib/image-rung";

const DEPTH = [12, 21, 9, 23, 14, 17];

export function DiscoveryQueueCta({ items, title }: { items: FeedItem[]; title?: string }) {
  const { settings } = useSettings();
  const { openQueue } = useView();
  const t = useT();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);
  const peek = items.slice(0, 6);

  if (peek.length === 0) return null;

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
          {title ?? t("Your Discovery Queue")}
        </h2>
        <span className="text-[12.5px] uppercase tracking-[0.2em] text-ink-subtle">
          {t("{count} picks ready", { count: items.length })}
        </span>
      </div>
      <button
        ref={ref}
        type="button"
        onClick={openQueue}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="group relative flex h-[190px] items-center justify-center overflow-hidden rounded-2xl border border-edge-soft bg-canvas text-start transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_30px_64px_-32px_rgba(0,0,0,0.7)] motion-reduce:hover:translate-y-0"
      >
        <div className="absolute inset-0 flex scale-[1.12]">
          {peek.map((item, i) => (
            <div
              key={item.meta.id}
              className="relative h-full min-w-0 flex-1 overflow-hidden [transition:transform_450ms_cubic-bezier(0.22,0.61,0.36,1)] group-hover:will-change-transform motion-reduce:transition-none motion-reduce:!transform-none"
              style={{ transform: `translate3d(calc(var(--px,0) * ${DEPTH[i]}px), calc(var(--py,0) * ${DEPTH[i] * 0.5}px), 0)` }}
            >
              <img
                src={artAtWidth(rpdbPoster(settings.rpdbKey, item.meta.id, item.meta.background ?? item.meta.poster), 200)}
                alt=""
                draggable={false}
                loading="lazy"
                onError={(e) => {
                  if (item.meta.poster && e.currentTarget.src !== item.meta.poster) e.currentTarget.src = item.meta.poster;
                }}
                className="absolute inset-0 h-full w-full object-cover brightness-[0.7] transition-[filter] duration-300 group-hover:brightness-90"
              />
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "color-mix(in oklch, var(--color-canvas), transparent 56%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 104% at 50% 50%, color-mix(in oklch, var(--color-canvas), transparent 26%) 0%, transparent 72%)",
          }}
        />

        <div
          className="relative flex items-center gap-4 [transition:transform_450ms_cubic-bezier(0.22,0.61,0.36,1)] group-hover:will-change-transform motion-reduce:transition-none motion-reduce:!transform-none"
          style={{ transform: "translate3d(calc(var(--px,0) * -16px), calc(var(--py,0) * -8px), 0)" }}
        >
          <span className="font-display text-[clamp(38px,5.5vw,58px)] font-medium leading-none tracking-tight text-ink [text-shadow:0_4px_30px_rgba(0,0,0,0.7)]">
            {t("Explore")}
          </span>
          <ArrowRight
            size={42}
            strokeWidth={2}
            className="dir-icon shrink-0 text-ink [filter:drop-shadow(0_4px_18px_rgba(0,0,0,0.6))] transition-transform duration-300 group-hover:translate-x-2 rtl:group-hover:-translate-x-2 motion-reduce:transition-none"
          />
        </div>
      </button>
    </section>
  );
}
