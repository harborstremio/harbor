import { FlameStreak } from "@/components/icons/flame-streak";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { sizeImageUrl } from "@/lib/img-size";
import { useSettings } from "@/lib/settings";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { usePosterChain } from "@/components/poster";
import { openVoyage, useVoyage } from "@/lib/voyage/store";

function capsuleBg(url?: string): string | undefined {
  if (!url) return url;
  return sizeImageUrl(url.replace("/background/medium/", "/background/small/"), 520);
}

export function VoyageBanner({ pool }: { pool: Meta[] }) {
  const t = useT();
  const { active, streak } = useVoyage();
  const accent = active?.accent ?? "var(--color-accent)";
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const items = useMemo(() => {
    const src = active?.pool?.length ? active.pool : pool;
    return src.filter((m) => m.background && m.background !== m.poster && m.name).slice(0, 8);
  }, [active, pool]);
  const strip = items.length >= 2 ? [...items, ...items] : items;

  const sailing = active?.phase === "sailing";
  const ready = !!active && !sailing && active.routeIds.length >= active.targetLength;
  const pitch = !active
    ? t("A short run of films you'll actually finish. You pick every stop.")
    : sailing
      ? t("{done} of {total} watched so far.", {
          done: active.playedIds.length,
          total: active.routeIds.length,
        })
      : ready
        ? t("Your queue is full. Start whenever you're ready.")
        : t("{done} of {total} films picked.", {
            done: active.routeIds.length,
            total: active.targetLength,
          });
  const cta = !active
    ? t("Start a voyage")
    : sailing
      ? t("Continue your voyage")
      : ready
        ? t("Start voyage")
        : t("Keep picking");

  return (
    <section ref={rootRef} className="group relative min-h-[172px] w-full overflow-hidden rounded-2xl bg-canvas ring-1 ring-edge-soft">
      <div
        className="absolute inset-y-0 z-0 overflow-hidden [transform:skewX(-8deg)]"
        style={{ left: "39%", right: "-34px" }}
      >
        <div
          className={`flex h-full items-stretch gap-2 ${reduce ? "" : "voyage-marquee"} group-hover:[animation-play-state:paused]`}
          style={{ width: "max-content", animationPlayState: onScreen ? undefined : "paused" }}
        >
          {strip.map((m, i) => (
            <VoyageCapsule key={`${m.id}-${i}`} meta={m} />
          ))}
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(103deg, var(--color-canvas) 0%, var(--color-canvas) 41%, color-mix(in oklch, var(--color-canvas), transparent 12%) 52%, color-mix(in oklch, var(--color-canvas), transparent 55%) 64%, transparent 78%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 z-[1] opacity-60"
        style={{ background: `radial-gradient(78% 120% at 0% 0%, color-mix(in oklch, ${accent}, transparent 84%), transparent 55%)` }}
      />

      <button type="button" onClick={openVoyage} aria-label={t("Open Voyages")} className="absolute inset-0 z-10 cursor-pointer" />

      <div className="pointer-events-none relative z-20 flex h-full min-h-[172px] max-w-[47%] flex-col justify-center gap-2.5 p-7">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {t("Harbor Voyages")}
          {streak > 1 && (
            <span className="ms-2 inline-flex h-[19px] items-baseline gap-0.5 rounded-full bg-elevated/70 ps-1.5 pe-2.5 align-middle text-ink">
              <FlameStreak size={13} style={{ color: accent }} />
              <span className="tabular-nums">{streak}</span>
            </span>
          )}
        </span>
        <h2 className="font-display text-[26px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[30px]">
          {active ? active.themeLabel : t("Set a course")}
        </h2>
        <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">{pitch}</p>
        <span className="mt-1 flex h-9 w-fit items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[filter,transform] duration-150 group-hover:brightness-105 group-active:scale-[0.97]">
          {cta}
        </span>
      </div>

      <style>{`
        @keyframes voyage-marquee { from { transform: translate3d(0,0,0) } to { transform: translate3d(-50%,0,0) } }
        .voyage-marquee { animation: voyage-marquee 48s linear infinite; }
      `}</style>
    </section>
  );
}

function VoyageCapsule({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <div className="relative h-full w-[236px] shrink-0 overflow-hidden bg-elevated">
      <img
        src={capsuleBg(meta.background)}
        alt=""
        draggable={false}
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget;
          if (meta.background && el.src.includes("/background/small/")) el.src = meta.background;
          else if (meta.poster && el.src !== meta.poster) el.src = meta.poster;
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(135% 130% at 100% 0%, transparent 26%, color-mix(in oklch, var(--color-canvas), transparent 6%) 92%)" }}
      />
      <div className="absolute bottom-3 left-4 flex items-end gap-2.5 [transform:skewX(8deg)]">
        <span className="block h-[68px] w-[46px] shrink-0 overflow-hidden rounded-sm shadow-[0_8px_18px_-6px_rgba(0,0,0,0.85)] ring-1 ring-white/15">
          <img src={poster.src} onError={poster.onError} alt="" draggable={false} className="h-full w-full object-cover" />
        </span>
        <span className="line-clamp-2 max-w-[8.5rem] pb-1 text-[12px] font-semibold leading-tight text-ink [text-shadow:0_1px_6px_rgba(0,0,0,0.95)]">
          {meta.name}
        </span>
      </div>
    </div>
  );
}
