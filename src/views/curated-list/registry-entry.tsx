import { ChevronDown, ExternalLink } from "lucide-react";
import { Fragment, memo, useState } from "react";
import { Poster } from "@/components/poster";
import { itemMeta } from "@/lib/curated/registry";
import type { CuratedList, CuratedListItem } from "@/lib/curated/types";
import type { RegistryEntry as Entry } from "@/lib/film-registry/types";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";

const QUIET =
  "inline-flex items-center gap-1.5 rounded-sm py-2 text-[13px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-ink-subtle";

function Credits({ crew }: { crew: NonNullable<Entry["crew"]> }) {
  const t = useT();
  return (
    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,128px)_minmax(0,1fr)]">
      {crew.map(([role, names]) => (
        <Fragment key={role}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t(role)}
          </dt>
          <dd className="mb-2 text-[13.5px] leading-[1.5] text-ink sm:mb-0">{names.join(", ")}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function RegistryEntryBody({
  list,
  item,
  entry,
  inducted,
}: {
  list: CuratedList;
  item: CuratedListItem;
  entry: Entry | undefined;
  inducted: number | null;
}) {
  const t = useT();
  const { openMeta } = useView();
  const [showCredits, setShowCredits] = useState(false);
  const meta = itemMeta(list, item);
  const open = () => openMeta(meta);
  const crew = entry?.crew;
  const essay = entry?.essay;
  const years = entry?.years ?? (item.year != null ? String(item.year) : null);

  return (
    <article className="flex gap-6 border-b border-edge-soft pb-10 last:border-b-0 sm:gap-8">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={open}
        className="w-[104px] shrink-0 self-start rounded-[var(--poster-radius,12px)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-0.5 sm:w-[128px]"
      >
        <Poster src={meta.poster} seed={item.imdb} ratio="portrait" lazy />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={open}
            className="min-w-0 rounded-sm text-start text-[18px] font-medium tracking-tight text-ink underline-offset-[5px] hover:underline focus:outline-none focus:ring-1 focus:ring-inset focus:ring-ink-subtle"
          >
            {item.title}
          </button>
          <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink-subtle">
            {years && <span className="tabular-nums">{years}</span>}
            {years && inducted != null && (
              <span aria-hidden className="opacity-40">
                ·
              </span>
            )}
            {inducted != null && (
              <span className="tabular-nums">{t("Inducted {year}", { year: inducted })}</span>
            )}
          </span>
        </div>

        {entry?.note && (
          <p className="max-w-prose text-[15px] leading-[1.7] text-ink-muted">{entry.note}</p>
        )}

        {(crew || essay) && (
          <div className="flex flex-wrap items-center gap-x-6">
            {crew && (
              <button
                type="button"
                onClick={() => setShowCredits((v) => !v)}
                aria-expanded={showCredits}
                className={`${QUIET} text-ink-muted hover:text-ink`}
              >
                {t("Credits")}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${showCredits ? "rotate-180" : ""}`}
                />
              </button>
            )}
            {essay && (
              <button
                type="button"
                onClick={() => openUrl(essay.url)}
                className={`${QUIET} text-ink-subtle underline-offset-4 hover:text-ink hover:underline`}
              >
                {essay.by ? t("Essay by {name}", { name: essay.by }) : t("Essay from the Library")}
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        )}

        {showCredits && crew && <Credits crew={crew} />}
      </div>
    </article>
  );
}

export const RegistryEntry = memo(RegistryEntryBody);
