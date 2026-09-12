import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  tmdbBrandRanking,
  tmdbBrandRankingCached,
  type BrandKind,
  type BrandScope,
  type BrandSummary,
} from "@/lib/providers/tmdb/tmdb-brands";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { Row } from "./row";

export function useBrandRanking(kind: BrandKind, scope: BrandScope = "top"): { brands: BrandSummary[]; loading: boolean } {
  const [brands, setBrands] = useState<BrandSummary[]>(() => tmdbBrandRankingCached(kind, scope));
  const [loading, setLoading] = useState(brands.length === 0);
  useEffect(() => {
    let alive = true;
    const cached = tmdbBrandRankingCached(kind, scope);
    if (cached.length > 0) {
      setBrands(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    void tmdbBrandRanking(kind, scope).then((list) => {
      if (!alive) return;
      setBrands(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [kind, scope]);
  return { brands, loading };
}

export function BrandTiles({ kind, title }: { kind: BrandKind; title?: string }) {
  const t = useT();
  const { settings } = useSettings();
  const { openBrands } = useView();
  const { brands } = useBrandRanking(kind);
  if (!settings.tmdbKey || brands.length === 0) return null;
  return (
    <Row
      title={title ?? (kind === "studio" ? t("Top studios") : t("Top networks"))}
      min={210}
      shape="tile"
      alwaysActive
      onViewAll={() => openBrands(kind)}
      viewAllLabel={t("See all")}
    >
      {brands.slice(0, 18).map((b) => (
        <BrandTile key={b.id} brand={b} />
      ))}
    </Row>
  );
}

export function BrandTile({ brand, facts }: { brand: BrandSummary; facts?: string }) {
  const t = useT();
  const { openFilter } = useView();
  const [logoBroken, setLogoBroken] = useState(false);
  const open = () => openFilter({ kind: brand.kind, mediaType: brand.media, name: brand.name, id: brand.id });
  const line = facts ?? (brand.count > 0 ? t("{n} titles", { n: brand.count.toLocaleString() }) : "");
  const showLogo = !!brand.logo && !logoBroken;
  return (
    <button
      type="button"
      onClick={open}
      aria-label={brand.name}
      className="group relative aspect-[5/4] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft bg-elevated text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
    >
      <div aria-hidden className="absolute inset-0 flex">
        {brand.art.map((src) => (
          <span key={src} className="relative min-w-0 flex-1">
            <img
              src={src}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-55"
            />
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,10,14,0.30) 0%, rgba(8,10,14,0.50) 55%, rgba(8,10,14,0.92) 100%)",
        }}
      />
      <div className="absolute inset-x-5 top-4 bottom-[58px] flex items-center justify-center">
        {showLogo ? (
          <span className="inline-flex max-h-full max-w-[82%] items-center justify-center rounded-xl bg-white/[0.94] px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
            <img
              src={brand.logo ?? undefined}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              onError={() => setLogoBroken(true)}
              className="max-h-[42px] max-w-full object-contain"
            />
          </span>
        ) : (
          <span className="text-center font-display text-[26px] font-medium leading-tight tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.5)]">
            {brand.name}
          </span>
        )}
      </div>
      <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-white/95">{brand.name}</span>
          {line && <span className="block text-[12px] text-white/65">{line}</span>}
        </span>
        <span
          className="dir-icon text-[18px] text-white/80 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}
