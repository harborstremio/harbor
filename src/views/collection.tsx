import { useEffect, useRef, useState, type ReactNode } from "react";
import { PickCard } from "@/components/pick-card";
import type { Meta } from "@/lib/cinemeta";
import { tmdbCollection, type TmdbCollection } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function CollectionView({ collectionId }: { collectionId: number }) {
  const t = useT();
  const { settings } = useSettings();
  const [data, setData] = useState<TmdbCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory(`collection-${collectionId}`, scrollRef);

  useEffect(() => {
    if (!settings.tmdbKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    tmdbCollection(settings.tmdbKey, collectionId)
      .then((c) => {
        if (cancelled) return;
        setData(c);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, collectionId]);

  const grid = "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
  const years = data ? yearRange(data.parts) : null;

  return (
    <main ref={scrollRef} data-rail-flush className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {data?.backdrop && (
        <div
          aria-hidden
          className="harbor-bleed-stremio pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px]"
          style={{
            backgroundImage: `url(${data.backdrop})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(64px) saturate(1.35)",
            opacity: 0.24,
          }}
        />
      )}
      <div className="relative">
        {data?.backdrop && (
          <div className="harbor-bleed-stremio pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
            <img src={data.backdrop} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/70 to-canvas/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/25 to-transparent" />
          </div>
        )}
        <div className="relative px-12 pt-28">
          <div className="mt-10 flex items-end gap-7 pb-2">
            {data?.poster && (
              <img
                src={data.poster}
                alt=""
                draggable={false}
                className="hidden w-44 shrink-0 rounded-2xl shadow-[0_28px_64px_-22px_rgba(0,0,0,0.75)] ring-1 ring-edge-soft sm:block"
              />
            )}
            <div className="min-w-0 max-w-3xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">{t("Collection")}</p>
              <h1 className="mt-2 font-display text-[clamp(34px,4.4vw,56px)] font-medium leading-[1.03] tracking-tight text-ink">
                {data?.name ?? t("Collection")}
              </h1>
              {data && data.parts.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] font-medium text-ink-muted">
                  <span>
                    {data.parts.length === 1
                      ? t("{n} film", { n: data.parts.length })
                      : t("{n} films", { n: data.parts.length })}
                  </span>
                  {years && (
                    <>
                      <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle/60" />
                      <span className="tabular-nums">{years}</span>
                    </>
                  )}
                </div>
              )}
              {data?.overview && (
                <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-ink-muted">{data.overview}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-12 pb-16 pt-10">
        {data && data.parts.length > 0 && (
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.2em] text-ink-subtle">{t("Films")}</h2>
        )}
        {loading ? (
          <div className={grid}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/40" />
            ))}
          </div>
        ) : !settings.tmdbKey ? (
          <Notice>{t("Add a TMDB key in Settings to browse collections.")}</Notice>
        ) : !data || data.parts.length === 0 ? (
          <Notice>{t("No films found in this collection.")}</Notice>
        ) : (
          <div className={grid}>
            {data.parts.map((m) => (
              <PickCard key={m.id} meta={m} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function yearRange(parts: Meta[]): string | null {
  const years = parts
    .map((p) => Number(p.releaseInfo))
    .filter((y) => Number.isFinite(y) && y > 1900);
  if (years.length === 0) return null;
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-[14.5px] text-ink-muted">
      {children}
    </div>
  );
}
