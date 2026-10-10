import { useMemo, useState } from "react";
import { CollectionCard } from "@/components/collection-card";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import { useT, useUiLanguage } from "@/lib/i18n";
import { browseDiscoverKey } from "@/lib/providers/tmdb/browse-kind";
import type { BrandStats, BrandTitle } from "@/lib/providers/tmdb/tmdb-brands";
import { browsedId, type Browsed } from "./browsed";
import { RailSection } from "./rail-section";
import type { StandardRail } from "./rails-config";

export function compactMoney(n: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return `$${Math.round(n / 1e6)}M`;
  }
}

export function RailHeading({ title, kicker }: { title: string; kicker: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[20px] font-medium tracking-tight text-ink">{title}</span>
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{kicker}</span>
    </span>
  );
}

function CaptionCard({ title, caption }: { title: BrandTitle; caption: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <PickCard meta={title.meta} />
      <span className="truncate text-[12.5px] font-semibold tabular-nums text-ink-muted">{caption}</span>
    </div>
  );
}

export function BoxOfficeRail({ stats }: { stats: BrandStats }) {
  const t = useT();
  const lang = useUiLanguage();
  const posterRow = usePosterRow();
  if (stats.grossing.length < 3) return null;
  return (
    <Row {...posterRow} title={<RailHeading title={t("Top grossing")} kicker={t("Box office champions")} />}>
      {stats.grossing.map((x, i) => (
        <CaptionCard key={x.tmdbId} title={x} caption={`#${i + 1} · ${compactMoney(x.revenue, lang)}`} />
      ))}
    </Row>
  );
}

export function FranchisesRail({ stats, name }: { stats: BrandStats; name: string }) {
  const t = useT();
  if (stats.franchises.length < 2) return null;
  return (
    <Row title={<RailHeading title={t("Franchises")} kicker={t("The universes {name} built", { name })} />} min={250} shape="landscape">
      {stats.franchises.map((f) => (
        <CollectionCard key={f.id} id={f.id} name={f.name} knownBackdrop={f.backdrop} />
      ))}
    </Row>
  );
}

export function LongestRunningRail({ stats, name }: { stats: BrandStats; name: string }) {
  const t = useT();
  const posterRow = usePosterRow();
  if (stats.longest.length < 3) return null;
  return (
    <Row {...posterRow} title={<RailHeading title={t("Marathon material")} kicker={t("The longest-running shows on {name}", { name })} />}>
      {stats.longest.map((x) => (
        <CaptionCard
          key={x.tmdbId}
          title={x}
          caption={`${t("{n} episodes", { n: x.episodes })} · ${t("{n} seasons", { n: x.seasons })}`}
        />
      ))}
    </Row>
  );
}

export function DecadesSection({ filter, stats }: { filter: Browsed; stats: BrandStats }) {
  const t = useT();
  const firstYear = stats.first?.year ?? null;
  const decades = useMemo(() => {
    if (!firstYear) return [];
    const start = Math.floor(firstYear / 10) * 10;
    const end = Math.floor(new Date().getFullYear() / 10) * 10;
    const out: number[] = [];
    for (let d = start; d <= end; d += 10) out.push(d);
    return out;
  }, [firstYear]);
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked ?? decades[0] ?? null;
  const browseId = browsedId(filter);
  const rail = useMemo<StandardRail | null>(() => {
    if (active === null) return null;
    const dateKey = filter.mediaType === "movie" ? "primary_release_date" : "first_air_date";
    return {
      kind: "standard",
      id: `decade-${active}`,
      title: `${active}s`,
      kicker: "Through the decades",
      params: {
        [browseDiscoverKey(filter.kind)]: String(browseId),
        [`${dateKey}.gte`]: `${active}-01-01`,
        [`${dateKey}.lte`]: `${active + 9}-12-31`,
        sort_by: "popularity.desc",
        "vote_count.gte": "20",
      },
      noDedup: true,
    };
  }, [active, filter.kind, browseId, filter.mediaType]);
  if (decades.length < 2 || !rail) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{t("Through the decades")}</span>
        {decades.map((d) => (
          <button key={d} type="button" onClick={() => setPicked(d)} className={`brand-chip ${d === active ? "is-on" : ""}`}>
            {d}s
          </button>
        ))}
      </div>
      <RailSection key={rail.id} filter={filter} rail={rail} />
    </section>
  );
}
