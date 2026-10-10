import { useEffect, useMemo, useState } from "react";
import { useCinemetaRating } from "@/lib/providers/cinemeta-rating";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { useT, useUiLanguage } from "@/lib/i18n";
import {
  tmdbBrandDetails,
  tmdbBrandStats,
  type BrandDetails,
  type BrandStats,
  type BrandTitle,
} from "@/lib/providers/tmdb/tmdb-brands";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import { compactMoney } from "./brand-rails";
import { browsedId, type Browsed } from "./browsed";

export function useBrandStats(filter: Browsed): {
  details: BrandDetails | null;
  stats: BrandStats | null;
} {
  const { settings } = useSettings();
  const [details, setDetails] = useState<BrandDetails | null>(null);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const browseId = browsedId(filter);
  useEffect(() => {
    setDetails(null);
    setStats(null);
    if (!settings.tmdbKey) return;
    let alive = true;
    void tmdbBrandDetails(settings.tmdbKey, filter.kind, browseId).then((d) => {
      if (alive) setDetails(d);
    });
    void tmdbBrandStats(settings.tmdbKey, filter.kind, browseId, filter.mediaType).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [settings.tmdbKey, filter.kind, browseId, filter.mediaType]);
  return { details, stats };
}

type Fact = { key: string; value: string; label: string; title?: BrandTitle; sub?: string };

function FactCard({ fact }: { fact: Fact }) {
  const { openMeta } = useView();
  const sub = fact.title ? fact.title.meta.name : fact.sub;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-edge-soft bg-elevated/40 px-4 py-3.5">
      <span className="font-display text-[26px] font-medium leading-none tracking-tight text-ink tabular-nums">
        {fact.value}
      </span>
      <span className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {fact.label}
      </span>
      {sub &&
        (fact.title ? (
          <button
            type="button"
            onClick={() => openMeta(fact.title!.meta)}
            className="truncate text-start text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            {sub}
          </button>
        ) : (
          <span className="truncate text-[13px] text-ink-muted">{sub}</span>
        ))}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return <span className="brand-chip cursor-default">{children}</span>;
  return (
    <button type="button" onClick={onClick} className="brand-chip">
      {children}
    </button>
  );
}

export function BrandFacts({
  filter,
  details,
  stats,
}: {
  filter: Browsed;
  details: BrandDetails | null;
  stats: BrandStats | null;
}) {
  const t = useT();
  const uiLang = useUiLanguage();
  const { openFilter } = useView();
  const region = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([uiLang], { type: "region" });
      return (code: string) => {
        try {
          return names.of(code) ?? code;
        } catch {
          return code;
        }
      };
    } catch {
      return (code: string) => code;
    }
  }, [uiLang]);
  const tv = filter.mediaType === "tv";
  const acclaimedImdb = useCinemetaRating(stats?.mostAcclaimed?.imdbId ?? undefined);
  const genreTable = tv ? TV_GENRES : MOVIE_GENRES;

  const facts: Fact[] = [];
  if (stats) {
    if (stats.first?.year) {
      facts.push({
        key: "first",
        value: String(stats.first.year),
        label: tv ? t("First aired") : t("First release"),
        title: stats.first,
      });
    }
    if (!tv && stats.totalGross > 0) {
      facts.push({
        key: "gross",
        value: compactMoney(stats.totalGross, uiLang),
        label: t("Combined box office"),
        sub: t("Top {n} titles", { n: stats.grossing.length }),
      });
    }
    if (!tv && stats.grossing[0]) {
      facts.push({
        key: "top",
        value: compactMoney(stats.grossing[0].revenue, uiLang),
        label: t("Highest-grossing"),
        title: stats.grossing[0],
      });
    }
    if (tv && stats.longest[0]) {
      facts.push({
        key: "longest",
        value: t("{n} episodes", { n: stats.longest[0].episodes }),
        label: t("Longest-running"),
        title: stats.longest[0],
      });
    }
    if (tv && stats.titles.length > 0) {
      facts.push({
        key: "onair",
        value: String(stats.onAir),
        label: t("Still on air"),
        sub: t("of {n} top shows", { n: stats.titles.length }),
      });
    }
    if (stats.mostAcclaimed) {
      const score = acclaimedImdb ?? (stats.mostAcclaimed.rating ?? 0).toFixed(1);
      facts.push({
        key: "acclaimed",
        value: `★ ${score}`,
        label: acclaimedImdb ? t("Highest rated on IMDb") : t("Most acclaimed"),
        title: stats.mostAcclaimed,
      });
    }
  }

  const chips: React.ReactNode[] = [];
  if (details?.country) chips.push(<Chip key="country">{region(details.country)}</Chip>);
  if (details?.headquarters)
    chips.push(<Chip key="hq">{t("Based in {city}", { city: details.headquarters })}</Chip>);
  if (details?.parent) {
    const parent = details.parent;
    chips.push(
      <Chip
        key="parent"
        onClick={() =>
          openFilter({
            kind: "studio",
            mediaType: filter.mediaType,
            name: parent.name,
            id: parent.id,
          })
        }
      >
        {t("Part of {parent}", { parent: parent.name })}
      </Chip>,
    );
  }
  if (details?.homepage) {
    const url = details.homepage;
    chips.push(
      <Chip key="site" onClick={() => openUrl(url)}>
        {t("Website")}
      </Chip>,
    );
  }
  const genres = (stats?.genres ?? [])
    .map((name) => ({ name, id: genreTable[name] }))
    .filter((g) => typeof g.id === "number");

  if (facts.length === 0 && chips.length === 0 && genres.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      {facts.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
          {facts.map((f) => (
            <FactCard key={f.key} fact={f} />
          ))}
        </div>
      )}
      {(chips.length > 0 || genres.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips}
          {genres.length > 0 && chips.length > 0 && <span className="brand-divider" />}
          {genres.length > 0 && (
            <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              {t("Signature genres")}
            </span>
          )}
          {genres.map((g) => (
            <Chip
              key={g.name}
              onClick={() =>
                openFilter({ kind: "genre", mediaType: filter.mediaType, name: g.name, id: g.id })
              }
            >
              {t(g.name)}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}
