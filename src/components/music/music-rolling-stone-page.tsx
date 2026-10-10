import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft } from "@/components/icons/music-icons";
import { Dropdown } from "@/components/dropdown";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import {
  RS_500_TITLE,
  RS_DECADES,
  RS_LIST_URL,
  RS_SOURCE,
  rollingStoneGenres,
  rollingStoneItems,
} from "@/lib/rolling-stone-500";
import type { MusicCatalogItem } from "@/lib/music/types";

export function MusicRollingStonePage({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
}) {
  const t = useT();
  const [decade, setDecade] = useState<number | null>(null);
  const [genre, setGenre] = useState("all");
  const [query, setQuery] = useState("");
  const genres = useMemo(() => rollingStoneGenres(), []);
  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return rollingStoneItems({ decade, genre: genre === "all" ? null : genre }).filter(
      (item) =>
        !needle ||
        (item.kind === "album" &&
          `${item.title} ${item.artist}`.toLocaleLowerCase().includes(needle)),
    );
  }, [decade, genre, query]);

  return (
    <section className="music-billboard-page">
      <button type="button" className="music-home-text" data-music-inner-back onClick={onBack}>
        <ChevronLeft size={18} />
        {t("music.watch.back")}
      </button>
      <header>
        <MusicServiceLogo source="rollingstone" size={38} />
        <div>
          <h1>{RS_SOURCE}</h1>
          <p>{t(RS_500_TITLE)}</p>
        </div>
        <button type="button" className="music-home-text" onClick={() => openUrl(RS_LIST_URL)}>
          rollingstone.com
          <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="music-billboard-filters">
        <label>
          {t("music.rollingStone.decade")}
          <Dropdown
            value={decade === null ? "all" : String(decade)}
            ariaLabel={t("music.rollingStone.decade")}
            onChange={(value) => setDecade(value === "all" ? null : Number(value))}
            options={[
              { value: "all", label: t("music.rollingStone.all") },
              ...RS_DECADES.map((value) => ({ value: String(value), label: `${value}s` })),
            ]}
          />
        </label>
        <label>
          {t("music.rollingStone.genre")}
          <Dropdown
            value={genre}
            ariaLabel={t("music.rollingStone.genre")}
            onChange={setGenre}
            options={[
              { value: "all", label: t("music.rollingStone.all") },
              ...genres.map((name) => ({ value: name, label: name })),
            ]}
          />
        </label>
        <input
          type="search"
          value={query}
          placeholder={t("music.rollingStone.filter")}
          aria-label={t("music.rollingStone.filter")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <MusicCatalogRow
        row={{
          id: "rolling-stone-all",
          title: t("music.rollingStone.count", { count: items.length }),
          titleLiteral: true,
          layout: "covers",
          source: RS_SOURCE,
          items,
        }}
        status="ready"
        grid
        onOpen={(item) => onOpen(item, items)}
      />
    </section>
  );
}
