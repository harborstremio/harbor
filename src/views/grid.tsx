import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BackToTop } from "@/components/back-to-top";
import { PickCard } from "@/components/pick-card";
import { VirtualGrid } from "@/components/virtual-grid";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { layoutHasGlobalBack } from "@/lib/theme";
import { useScrollMemory, useView, type GridSpec } from "@/lib/view";

const PAGE_CAP = 40;

export function GridView({ grid }: { grid: GridSpec }) {
  const { goBack } = useView();
  const t = useT();
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [metas, setMetas] = useState<Meta[]>(grid.initial ?? []);
  const [page, setPage] = useState(grid.initial?.length ? 1 : 0);
  const [done, setDone] = useState(false);
  const loadingRef = useRef(false);
  useScrollMemory(`grid:${grid.title}`, scrollRef);

  useEffect(() => {
    if (done) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        const next = page + 1;
        grid
          .fetcher(next)
          .then((batch) => {
            setPage(next);
            if (batch.length === 0 || next >= PAGE_CAP) {
              setDone(true);
              return;
            }
            const seen = new Set(metas.map((m) => m.id));
            const fresh = batch.filter((m) => !seen.has(m.id));
            if (fresh.length === 0) setDone(true);
            else setMetas((prev) => [...prev, ...fresh]);
          })
          .catch(() => setDone(true))
          .finally(() => {
            loadingRef.current = false;
          });
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [grid, page, done, metas]);

  const hero = grid.kidsHero;
  const bgArt = metas.find((m) => m.background)?.background?.replace("/t/p/w780/", "/t/p/w1280/");

  const body = (
    <>
      <VirtualGrid
        items={metas}
        scrollRef={scrollRef}
        minColumnWidth={150}
        gapX={16}
        gapY={32}
        estimateRowHeight={260}
        getKey={(m, i) => `${m.id}-${i}`}
        renderItem={(m) => <PickCard meta={m} kids={!!hero} />}
      />
      {!done && <div ref={sentinelRef} className="h-24" />}
      {done &&
        metas.length === 0 &&
        (hero ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <img
              src="/kids/doodles/lilpurpocto.png"
              alt=""
              draggable={false}
              className="h-20 w-auto opacity-80"
            />
            <p className="font-display text-[24px] font-bold text-[#0e3a43]">
              {t("Nothing here yet!")}
            </p>
          </div>
        ) : (
          <p className="py-20 text-center text-[14px] text-ink-subtle">Nothing here yet.</p>
        ))}
    </>
  );

  return (
    <main ref={scrollRef} className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
      {hero ? (
        <>
          <section className="relative h-[66vh] min-h-[460px] w-full overflow-hidden">
            {bgArt ? (
              <img
                src={bgArt}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${hero.grad}`} />
            )}
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-tr ${hero.grad} opacity-25 mix-blend-overlay`}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/35 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
            <img
              src={hero.art}
              alt=""
              draggable={false}
              className="pointer-events-none absolute bottom-0 end-0 h-[56%] w-auto max-w-[30%] object-contain object-bottom drop-shadow-[0_14px_28px_rgba(0,0,0,0.4)]"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 px-12 pb-9">
              <h1 className="max-w-[62%] font-display text-[clamp(46px,7vw,88px)] font-extrabold leading-[0.92] tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)]">
                {hero.name}
              </h1>
              <p className="text-[18px] font-extrabold text-white/95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                {metas.length} {metas.length === 1 ? t("title") : t("titles")}
              </p>
            </div>
          </section>
          <div className="flex w-full flex-col gap-8 px-12 pb-24 pt-6">{body}</div>
        </>
      ) : (
        <div className="flex w-full flex-col gap-8 px-12 pb-24 pt-24">
          <div className="flex items-center gap-4">
            {!layoutHasGlobalBack() && (
              <button
                onClick={goBack}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:text-ink"
              >
                <ArrowLeft size={18} strokeWidth={2.2} />
              </button>
            )}
            <h1 className="font-display text-[30px] font-medium leading-none tracking-tight text-ink">
              {grid.title}
            </h1>
            <span className="text-[14px] text-ink-subtle">{metas.length} titles</span>
          </div>
          {body}
        </div>
      )}
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
