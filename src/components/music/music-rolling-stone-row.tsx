import { useMemo, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { useT } from "@/lib/i18n";
import {
  RS_500_TITLE,
  RS_DECADES,
  RS_SOURCE,
  rollingStoneGenres,
  rollingStoneItems,
} from "@/lib/rolling-stone-500";
import type { MusicCatalogItem } from "@/lib/music/types";

export function MusicRollingStoneRow({
  title,
  onOpen,
  onPlay,
  onViewAll,
}: {
  title?: string;
  onOpen?: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onPlay?: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onViewAll?: () => void;
}) {
  const t = useT();
  const [decade, setDecade] = useState<number | null>(null);
  const [genre, setGenre] = useState("all");
  const genres = useMemo(rollingStoneGenres, []);
  const items = useMemo(
    () => rollingStoneItems({ decade, genre: genre === "all" ? null : genre }),
    [decade, genre],
  );

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <DecadeChip
          label={t("music.rollingStone.all")}
          active={decade === null}
          onClick={() => setDecade(null)}
        />
        {RS_DECADES.map((value) => (
          <DecadeChip
            key={value}
            label={`${String(value).slice(2)}s`}
            active={decade === value}
            onClick={() => setDecade(value)}
          />
        ))}
        <span className="ms-auto w-[190px] max-w-full">
          <Dropdown
            value={genre}
            ariaLabel={t("music.rollingStone.genre")}
            onChange={setGenre}
            options={[
              { value: "all", label: t("music.rollingStone.allGenres") },
              ...genres.map((name) => ({ value: name, label: name })),
            ]}
          />
        </span>
      </div>
      <MusicCatalogRow
        row={{
          id: `rolling-stone-${decade ?? "all"}-${genre}`,
          title: title ?? t(RS_500_TITLE),
          titleLiteral: true,
          subtitle: t("music.rollingStone.count", { count: items.length }),
          layout: "covers",
          source: RS_SOURCE,
          items,
        }}
        status="ready"
        emptyLabel={t("music.rollingStone.empty")}
        titleLogo={<MusicServiceLogo source="rollingstone" size={18} />}
        onViewAll={onViewAll}
        onOpen={onOpen && ((item) => onOpen(item, items))}
        onPlay={onPlay && ((item) => onPlay(item, items))}
        playable
      />
    </section>
  );
}

function DecadeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 rounded-full px-3 text-[12px] font-medium transition-colors duration-150 ease-out ${
        active ? "bg-ink text-canvas" : "bg-elevated text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
