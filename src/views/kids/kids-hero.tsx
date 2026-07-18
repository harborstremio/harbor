import { useEffect, useMemo, useState } from "react";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbLogo } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

export function KidsHero({ featured }: { featured: Meta[] }) {
  const t = useT();
  const { openMeta } = useView();

  const cards = useMemo(() => {
    const usable = featured.filter((m) => m.background || m.poster);
    const arr = usable.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 5);
  }, [featured]);

  return (
    <section className="harbor-bleed-stremio relative h-[72vh] min-h-[620px] overflow-hidden bg-canvas">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/kids/kidbgsvg.svg)",
          backgroundSize: "cover",
          backgroundPosition: "center 24px",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas via-canvas/55 to-transparent" />

      <div className="relative flex h-full flex-col items-center justify-end gap-5 px-8 pb-[17vh]">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.42em] text-ink-muted">
            {t("Just for kids")}
          </span>
          <h1
            className="text-[clamp(34px,4.8vw,56px)] font-bold leading-[1.0] tracking-tight text-ink"
            style={{ fontFamily: '"Fredoka", "Baloo 2", system-ui, sans-serif' }}
          >
            {t("What should we watch?")}
          </h1>
        </div>
        <div className="flex w-full flex-nowrap items-end justify-center gap-3.5">
          {cards.length === 0
            ? Array.from({ length: 5 }).map((_, i) => <KidsHeroSkeleton key={i} />)
            : cards.map((m, i) => (
                <KidsHeroCard key={m.id} meta={m} index={i} onOpen={() => openMeta(m)} />
              ))}
        </div>
      </div>
    </section>
  );
}

function KidsHeroCard({ meta, index, onOpen }: { meta: Meta; index: number; onOpen: () => void }) {
  const { settings } = useSettings();
  const art = upsizeCard(meta.background) || meta.poster;
  const [logo, setLogo] = useState<string | undefined>(meta.logo);
  useEffect(() => {
    if (logo) return;
    let cancelled = false;
    const isTmdb = meta.id.startsWith("tmdb:");
    const lookup = isTmdb
      ? tmdbLogo(settings.tmdbKey, meta.id, meta.originalLanguage)
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => full?.logo);
    lookup
      .then((url) => {
        if (!cancelled && url) setLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, logo, settings.tmdbKey]);

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${index * 70}ms` }}
      className="kids-card group relative h-[120px] min-w-0 max-w-[212px] flex-1 basis-[212px] overflow-hidden rounded-[22px] bg-surface shadow-[0_16px_40px_-14px_rgba(20,40,60,0.45)] ring-2 ring-white transition duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-14px_rgba(20,40,60,0.55)] active:scale-[0.98]"
    >
      {art && (
        <img
          src={art}
          alt={meta.name}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      {logo ? (
        <img
          src={logo}
          alt={meta.name}
          draggable={false}
          className="absolute inset-x-3 bottom-3 mx-auto max-h-11 w-auto max-w-[86%] object-contain drop-shadow-[0_2px_9px_rgba(0,0,0,0.75)]"
        />
      ) : (
        <span className="absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-center font-display text-[15px] font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
          {meta.name}
        </span>
      )}
    </button>
  );
}

function KidsHeroSkeleton() {
  return (
    <div className="h-[120px] min-w-0 max-w-[212px] flex-1 basis-[212px] animate-pulse rounded-[22px] bg-white/40 ring-2 ring-white/60" />
  );
}

function upsizeCard(url?: string): string | undefined {
  return url ? url.replace("/t/p/w780/", "/t/p/w500/") : url;
}
