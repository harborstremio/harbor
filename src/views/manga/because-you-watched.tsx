import { ArrowedScrollRow } from "@/components/arrowed-scroll-row";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { useBecauseYouWatched } from "@/lib/manga/use-because-you-watched";
import type { MangaSummary } from "@/lib/manga/types";
import { CollapsibleSection } from "./collapsible-section";

export function BecauseYouWatched({ onOpen }: { onOpen: (item: MangaSummary) => void }) {
  const { recs, loading } = useBecauseYouWatched();
  const t = useT();
  if (recs.length === 0 && !loading) return null;

  return (
    <CollapsibleSection
      storageKey="harbor.manga.becauseYouWatchedOpen"
      className="mt-8"
      hideKey="because-you-watched"
      title={t("Because you watched")}
    >
      <p className="text-[13px] text-ink-subtle">
        {t("Keep going in the manga behind the anime you've been watching")}
      </p>
      {recs.length === 0 ? (
        <div className="-mx-1 flex gap-3 px-1 py-3" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0 animate-pulse motion-reduce:animate-none">
              <div className="aspect-[2/3] w-full rounded-xl bg-elevated/60" />
              <div className="mt-2 h-3.5 w-4/5 rounded bg-elevated/50" />
            </div>
          ))}
        </div>
      ) : (
      <ArrowedScrollRow className="-mx-1">
        {recs.map(({ animeName, manga }) => (
          <button
            key={manga.id}
            type="button"
            onClick={() => onOpen(manga)}
            style={{ scrollSnapAlign: "start" }}
            className="group flex w-36 shrink-0 flex-col gap-2 text-start"
          >
            <div className="relative w-full transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
              <Poster
                src={manga.cover}
                seed={manga.id}
                ratio="portrait"
                className="harbor-card-ring rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="line-clamp-1 text-[13px] font-medium leading-snug text-ink">{manga.title}</p>
              <p className="line-clamp-1 text-[11px] leading-snug text-ink-subtle">
                <span className="font-semibold text-accent/85">{t("You watched")}</span> {animeName}
              </p>
            </div>
          </button>
        ))}
      </ArrowedScrollRow>
      )}
    </CollapsibleSection>
  );
}
