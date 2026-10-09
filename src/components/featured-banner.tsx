import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { observe, usePageVisible } from "@/lib/visibility";
import { BigCardStack } from "./featured-banner/big-card-stack";
import { Lightbox } from "./featured-banner/lightbox";
import { SidePanel } from "./featured-banner/side-panel";
import { Dots } from "./featured-banner/stepper";
import type { LightboxState } from "./featured-banner/types";

const ROTATE_MS = 14000;

export function FeaturedBanner({ items }: { items: Meta[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const visible = usePageVisible();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  if (items.length > 0) hasLoadedRef.current = true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, setInView);
  }, []);

  useEffect(() => {
    if (paused || lightbox || !inView || !visible || items.length < 2) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, lightbox, inView, visible, items.length]);

  useEffect(() => {
    if (active >= items.length && items.length > 0) setActive(items.length - 1);
  }, [items.length, active]);

  if (items.length === 0) {
    if (hasLoadedRef.current) return null;
    return (
      <section className="flex flex-col gap-5">
        <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
          {t("Recommended")}
        </h2>
        <BannerSkeleton />
      </section>
    );
  }

  const safeActive = Math.min(active, items.length - 1);
  const current = items[safeActive];

  const goPrev = () => setActive((i) => (i - 1 + items.length) % items.length);
  const goNext = () => setActive((i) => (i + 1) % items.length);

  return (
    <section
      ref={ref}
      className="flex flex-col gap-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
        {t("Recommended")}
      </h2>

      <div className="harbor-step grid grid-cols-[minmax(0,1fr)_320px] gap-4 motion-reduce:animate-none">
        <BigCardStack items={items} active={safeActive} onPrev={goPrev} onNext={goNext} />
        <SidePanel
          meta={current}
          activeIndex={safeActive}
          total={items.length}
          onOpenLightbox={setLightbox}
        />
      </div>

      <div className="harbor-step motion-reduce:animate-none">
        <Dots count={items.length} active={safeActive} onJump={setActive} />
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function BannerSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
      <div className="aspect-[16/9] animate-pulse rounded-2xl bg-elevated/30" />
      <div className="animate-pulse rounded-2xl bg-elevated/25" />
    </div>
  );
}
