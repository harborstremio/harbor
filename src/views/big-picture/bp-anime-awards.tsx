import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import {
  allAwardSources,
  animeAwardId,
  awardSourceMeta,
  readAnimeAwardSource,
  type AnimeAwardCategory,
  type AwardSourceId,
} from "@/lib/anime-awards";
import { resolveAwardIcon, useAwardPacks } from "@/lib/award-icons";
import { pushBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { BpChip, BpChipRow } from "./bp-library-chips";
import { useBpT } from "./bp-i18n";

const COLUMNS = "repeat(auto-fill, minmax(clamp(230px, 21vw, 400px), 1fr))";

export function awardSourceIcon(id: AwardSourceId, custom: Record<string, string>): {
  src: string;
  invert: boolean;
} {
  const meta = awardSourceMeta(id);
  const src = resolveAwardIcon(`${id}_logo`) ?? resolveAwardIcon(id) ?? meta.icon;
  const overridden = Boolean(custom[`${id}_logo`] ?? custom[id]);
  return { src, invert: !overridden };
}

export function BpAnimeAward({
  sourceId,
  onSelect,
}: {
  sourceId?: AwardSourceId;
  onSelect?: (m: Meta) => void;
}) {
  const t = useBpT();
  const { custom } = useAwardPacks();
  const [source, setSource] = useState<AwardSourceId>(sourceId ?? "crunchyroll");
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    if (!sourceId) return;
    setSource(sourceId);
  }, [sourceId]);

  useEffect(() => {
    setYear(null);
  }, [source]);

  const data = useMemo(() => readAnimeAwardSource(source), [source]);
  const sources = useMemo(() => allAwardSources(), []);
  const totalWins = data.categories.reduce((n, c) => n + c.winners.length, 0);
  const yearSpan =
    data.years.length === 0
      ? ""
      : data.years.length === 1
        ? String(data.years[0])
        : `${data.years[data.years.length - 1]} - ${data.years[0]}`;

  const categories = useMemo(() => {
    if (year === null) return data.categories;
    return data.categories
      .map((c) => ({ ...c, winners: c.winners.filter((w) => w.year === year) }))
      .filter((c) => c.winners.length > 0);
  }, [data.categories, year]);

  const perYear = useMemo(() => {
    const counts = new Map<number, number>();
    for (const c of data.categories) {
      for (const w of c.winners) counts.set(w.year, (counts.get(w.year) ?? 0) + 1);
    }
    return counts;
  }, [data.categories]);

  const icon = awardSourceIcon(source, custom);

  return (
    <div className="flex h-full flex-col pt-[var(--bp-page-top)] pb-[var(--bp-safe-y,0px)]">
      <div className="flex flex-col gap-[clamp(7px,1vh,15px)] px-[var(--bp-gutter)]">
        <div className="flex items-center gap-[clamp(10px,1vw,20px)]">
          <img
            src={icon.src}
            alt=""
            className={`h-[clamp(30px,4.4vh,58px)] w-auto max-w-[clamp(90px,11vw,190px)] object-contain ${
              icon.invert ? "brightness-0 invert" : ""
            }`}
          />
          <div className="flex flex-col">
            <span className="flex items-center gap-[clamp(5px,0.5vw,9px)] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.2em] text-ink-subtle">
              <Trophy size={16} strokeWidth={2.6} />
              {t("Anime award")}
            </span>
            <h1
              className="font-display text-[clamp(22px,3.6vh,50px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink"
            >
              {data.meta.name}
            </h1>
          </div>
        </div>
        <p className="text-[clamp(18px,2.5vh,24px)] font-semibold text-ink-muted">
          {t("{n} recorded winners", { n: totalWins })}
          <span aria-hidden className="mx-[0.55em] opacity-40">
            •
          </span>
          {data.categories.length === 1
            ? t("{n} category", { n: data.categories.length })
            : t("{n} categories", { n: data.categories.length })}
          {yearSpan && (
            <>
              <span aria-hidden className="mx-[0.55em] opacity-40">
                •
              </span>
              {yearSpan}
            </>
          )}
        </p>
      </div>

      <div className="mt-[clamp(9px,1.3vh,20px)] flex flex-col gap-[clamp(6px,0.9vh,14px)] px-[var(--bp-gutter)]">
        <BpChipRow>
          {sources.map((id) => (
            <BpChip
              key={id}
              label={awardSourceMeta(id).name}
              selected={id === source}
              onSelect={() => setSource(id)}
            />
          ))}
        </BpChipRow>
        {data.years.length > 0 && (
          <BpChipRow>
            <BpChip
              label={t("All years")}
              count={totalWins}
              selected={year === null}
              onSelect={() => setYear(null)}
            />
            {data.years.map((y) => (
              <BpChip
                key={y}
                label={String(y)}
                count={perYear.get(y)}
                ariaLabel={`${y}, ${t("{n} winners", { n: perYear.get(y) ?? 0 })}`}
                selected={year === y}
                onSelect={() => setYear(year === y ? null : y)}
              />
            ))}
          </BpChipRow>
        )}
      </div>

      <div
        data-bp-scroll-y
        className="mt-[clamp(9px,1.3vh,20px)] min-h-0 flex-1 overflow-y-auto px-[var(--bp-gutter)] pt-[10px] pb-[var(--bp-hint-h)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.length === 0 ? (
          <p className="max-w-[min(52vw,820px)] text-[clamp(18px,2.5vh,24px)] text-ink-subtle">
            {data.categories.length === 0
              ? t("No data shipped for this award yet.")
              : t("No winners match these filters.")}
          </p>
        ) : (
          <div className="flex flex-col gap-[clamp(18px,2.6vh,42px)]">
            {categories.map((c) => (
              <BpAwardCategory
                key={c.key}
                category={c}
                showLatest={year === null}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BpAwardCategory({
  category,
  showLatest,
  onSelect,
}: {
  category: AnimeAwardCategory;
  showLatest: boolean;
  onSelect?: (m: Meta) => void;
}) {
  const t = useBpT();
  return (
    <section className="flex flex-col gap-[clamp(7px,1vh,15px)]">
      <div className="flex items-baseline justify-between gap-[clamp(9px,1vw,18px)] border-b border-[var(--bp-edge)] pb-[clamp(5px,0.7vh,11px)]">
        <h2
          className="flex items-center gap-[clamp(6px,0.6vw,12px)] text-[clamp(22px,3vh,28px)] font-bold tracking-[-0.01em] text-ink"
        >
          {category.isAOTY && (
            <span className="rounded-full bg-[var(--bp-glass)] px-[clamp(7px,0.7vw,13px)] py-[2px] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.18em] text-ink-muted">
              {t("Grand")}
            </span>
          )}
          {category.name}
        </h2>
        <span className="shrink-0 text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {category.winners.length === 1
            ? t("{n} winner", { n: category.winners.length })
            : t("{n} winners", { n: category.winners.length })}
        </span>
      </div>
      <div
        data-bp-grid
        className="grid"
        style={{ gridTemplateColumns: COLUMNS, gap: "clamp(14px,1.1vw,22px)" }}
      >
        {category.winners.map((w, i) => (
          <BpAwardWinner
            key={`${w.year}-${w.title}-${i}`}
            year={w.year}
            title={w.title}
            latest={showLatest && i === 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function BpAwardWinner({
  year,
  title,
  latest,
  onSelect,
}: {
  year: number;
  title: string;
  latest: boolean;
  onSelect?: (m: Meta) => void;
}) {
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const mappedId = animeAwardId(title);
  const open = (meta: Meta) => {
    if (onSelect) {
      onSelect(meta);
      return;
    }
    pushBigPicture({ kind: "detail", metaId: `${meta.type}:${meta.id}` });
  };

  const activate = async () => {
    if (busy) return;
    SFX.click();
    if (mappedId) {
      open({ id: mappedId, type: "series", name: title });
      return;
    }
    if (!settings.tmdbKey) return;
    setBusy(true);
    try {
      const tv = await searchTmdb(settings.tmdbKey, title, year, "tv");
      if (tv) {
        open({ id: `tmdb:tv:${tv}`, type: "series", name: title });
        return;
      }
      const movie = await searchTmdb(settings.tmdbKey, title, year, "movie");
      if (movie) open({ id: `tmdb:movie:${movie}`, type: "movie", name: title });
    } finally {
      setBusy(false);
    }
  };

  // Still focusable when inert: with no TMDB key every unmapped winner drops out
  // at once, and a grid the ring cannot enter is a dead end, not a disabled cell.
  const inert = !mappedId && !settings.tmdbKey;
  const dim = inert || busy;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      data-bp-restore-key={`${year}:${title}`}
      onClick={() => void activate()}
      aria-label={`${title}, ${year}`}
      className={`flex min-h-[clamp(44px,5vh,58px)] items-center gap-[clamp(9px,0.9vw,16px)] rounded-[var(--bp-r-sm)] px-[clamp(9px,0.85vw,15px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)] ${
        dim ? "opacity-55" : ""
      } ${
        latest
          ? "bg-[color-mix(in_oklab,var(--bp-panel)_55%,var(--bp-void))]"
          : "bg-[var(--bp-panel)]"
      }`}
    >
      <span
        className={`w-[3.4em] shrink-0 text-[clamp(18px,2.5vh,24px)] font-bold tabular-nums ${
          latest ? "text-ink" : "text-ink-subtle"
        }`}
      >
        {year}
      </span>
      <span className="line-clamp-2 text-[clamp(20px,2.8vh,26px)] font-semibold text-ink">
        {title}
      </span>
    </button>
  );
}

async function searchTmdb(
  key: string,
  title: string,
  year: number,
  type: "movie" | "tv",
): Promise<number | null> {
  const params = new URLSearchParams({ api_key: key, query: title, include_adult: "false" });
  if (type === "movie") params.set("year", String(year));
  else params.set("first_air_date_year", String(year));
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ id?: number }> };
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
