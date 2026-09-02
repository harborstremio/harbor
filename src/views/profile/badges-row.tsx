import { Award } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { HoverTooltip } from "@/components/hover-tooltip";
import { NavArrow } from "@/components/nav-arrow";
import { SectionHeader } from "./section-header";
import type { Badge } from "./profile-types";

function BadgeChip({ b }: { b: Badge }) {
  return (
    <HoverTooltip
      label={b.name}
      sublabel={b.description || null}
      side="top"
      align="center"
      className="group flex w-full flex-col items-center gap-2"
    >
      <div className="flex h-16 w-16 items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform motion-safe:group-hover:-translate-y-1">
        {b.iconUrl ? (
          <img
            src={b.iconUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
          />
        ) : (
          <Award size={40} className="text-ink-muted" />
        )}
      </div>
      <span className="line-clamp-2 text-center text-[11px] leading-tight text-ink-muted">{b.name}</span>
    </HoverTooltip>
  );
}

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const t = useT();
  const left = dir === "prev";
  return (
    <div
      className={`pointer-events-none absolute top-2 z-10 flex h-16 w-11 items-center opacity-0 transition-opacity duration-150 group-hover/badges:opacity-100 ${
        left ? "start-0 justify-start" : "end-0 justify-end"
      }`}
    >
      <NavArrow
        dir={left ? "left" : "right"}
        onClick={onClick}
        label={left ? t("Scroll left") : t("Scroll right")}
        size={26}
        className="pointer-events-auto h-11 w-11"
      />
    </div>
  );
}

function BadgesScroller({ badges }: { badges: Badge[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const atStart = e.deltaY < 0 && el.scrollLeft <= 0;
      const atEnd = e.deltaY > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", update);
    };
  }, [update, badges.length]);

  const scrollBy = (dir: number) => ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div className="group/badges relative">
      <div ref={ref} className="-mx-5 flex gap-4 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {badges.map((b) => (
          <div key={b.id} className="w-[72px] shrink-0">
            <BadgeChip b={b} />
          </div>
        ))}
      </div>
      {canPrev && <Arrow dir="prev" onClick={() => scrollBy(-1)} />}
      {canNext && <Arrow dir="next" onClick={() => scrollBy(1)} />}
    </div>
  );
}

export function BadgesRow({
  badges,
  onViewAll,
}: {
  badges: Badge[];
  onViewAll?: () => void;
  handle?: string;
}) {
  const t = useT();
  return (
    <section aria-label={t("Badges")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <SectionHeader
        icon={<Award size={20} />}
        label={t("Badges")}
        onViewAll={badges.length > 0 ? onViewAll : undefined}
      />
      {badges.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">{t("No badges earned yet")}</p>
      ) : (
        <BadgesScroller badges={badges} />
      )}
    </section>
  );
}
