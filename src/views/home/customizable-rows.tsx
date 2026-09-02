import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { LazyMount } from "@/components/lazy-mount";
import { releaseYear } from "@/lib/release-info";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import { CustomSourcesRow } from "@/components/custom-sources-row";
import { TopRankCard } from "@/components/top-rank-card";
import { LetterboxdRowMenu } from "@/components/letterboxd/letterboxd-row-menu";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { useT } from "@/lib/i18n";
import type { HomeRowCustomization } from "@/lib/home-customization";
import { useView } from "@/lib/view";
import type { HomeRow } from "./home-types";
import { RowControls } from "./row-controls";
import { watchTitleKey, type WatchedSet } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const BUILT_IN_HOME_ROW_TITLES: Readonly<Record<string, string>> = {
  "tmdb-trending-movies": "Trending This Week",
  "tmdb-now-playing": "In Theaters Now",
  "tmdb-popular-movies": "Popular Movies",
  "tmdb-trending-tv": "Trending Series",
  "tmdb-on-the-air": "On The Air",
  "tmdb-popular-tv": "Popular Series",
  "tmdb-top-rated-tv": "Top Rated Series",
  "tmdb-top-rated-movies": "Top Rated Movies",
  "cm-top-movies": "Top 10 on Stremio",
  "cm-popular": "Popular Movies",
  "cm-drama": "Top 10 Drama",
  "cm-trending-tv": "Trending Series",
  "cm-comedy": "Top 10 Comedy",
  "cm-action": "Action Hits",
  "cm-scifi": "Sci-Fi & Fantasy",
  "cm-thriller": "Thrillers",
  "cm-animation": "Animated Movies",
  "cm-horror": "Horror",
  "cm-romance": "Romance",
  "cm-adventure": "Adventure",
  "cm-documentary": "Documentaries",
  "cm-mystery": "Mystery",
  "cm-fantasy": "Fantasy",
  "cm-drama-tv": "Drama Series",
  "cm-comedy-tv": "Comedy Series",
  "cm-crime-tv": "Crime Series",
  "anime-airing": "Trending Anime",
  "anime-new": "New Anime Releases",
  "anime-popular": "Popular Anime",
  "anime-upcoming": "Upcoming Anime",
  "harbor-favorites": "Favorites",
  "harbor-watchlist": "My Watchlist",
  "trakt-watchlist": "Your Trakt Watchlist",
  "trakt-upcoming": "Up Next on Trakt",
  "trakt-recs-movies": "Trakt Recommends: Movies",
  "trakt-recs-shows": "Trakt Recommends: Series",
  "simkl-watching-shows": "Watching TV Shows on Simkl",
  "simkl-watching-anime": "Watching Anime on Simkl",
  "simkl-plantowatch-movies": "Plan to Watch Movies on Simkl",
  "simkl-plantowatch-shows": "Plan to Watch TV Shows on Simkl",
  "simkl-plantowatch-anime": "Plan to Watch Anime on Simkl",
  "simkl-upcoming": "Up Next on Simkl",
  "simkl-trending": "Simkl Trending Today",
};

export function displayRowTitle(row: HomeRow, renamed: boolean, t: Translate): string {
  if (renamed) return row.name;
  return BUILT_IN_HOME_ROW_TITLES[row.key] === row.name ? t(row.name) : row.name;
}

function metaTitleKey(meta: { id?: string }): string | null {
  const id = meta.id;
  if (!id) return null;
  if (/^tt\d+$/.test(id)) return `imdb:${id}`;
  if (id.startsWith("tmdb:")) {
    const num = Number(id.split(":")[2]);
    if (Number.isFinite(num)) return `tmdb:${num}`;
  }
  return null;
}

function isUnreleased(m: { releaseDate?: string; releaseInfo?: string }): boolean {
  if (m.releaseDate) {
    const t = Date.parse(m.releaseDate);
    if (!Number.isNaN(t)) return t > Date.now();
  }
  const yr = releaseYear(m.releaseInfo);
  if (!Number.isNaN(yr)) return yr > new Date().getFullYear();
  return false;
}

function RowTitle({ row, title }: { row: HomeRow; title: string }) {
  const t = useT();
  const { openGrid } = useView();
  const lb = useLetterboxd();
  const isLetterboxd = row.key.startsWith("letterboxd-");
  const catalogId = isLetterboxd ? row.key.replace("letterboxd-", "") : "";

  const badge = isLetterboxd ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
      Letterboxd
    </span>
  ) : null;

  const menu = isLetterboxd ? (
    <LetterboxdRowMenu
      canMoveUp={lb.catalogOrder.indexOf(catalogId) > 0}
      canMoveDown={
        lb.catalogOrder.indexOf(catalogId) < lb.catalogOrder.length - 1 &&
        lb.catalogOrder.indexOf(catalogId) !== -1
      }
      hidden={lb.hiddenCatalogs.includes(catalogId)}
      onMoveUp={() => lb.moveCatalog(catalogId, -1)}
      onMoveDown={() => lb.moveCatalog(catalogId, 1)}
      onToggleHidden={() => lb.toggleHidden(catalogId)}
    />
  ) : null;

  if (!row.fetcher)
    return (
      <>
        {title}
        {badge}
        {menu}
      </>
    );
  return (
    <button
      onClick={() => openGrid({ title, fetcher: row.fetcher!, initial: row.metas })}
      className="group/see inline-flex items-center gap-1.5 text-ink transition-colors hover:text-ink-muted"
    >
      {title}
      {badge}
      <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-ink-subtle opacity-0 transition-opacity duration-200 group-hover/see:opacity-100">
        {t("See all")}
        <ChevronRight size={14} strokeWidth={2.4} className="dir-icon" />
      </span>
    </button>
  );
}

function RowTitleExtra({ row }: { row: HomeRow }) {
  const lb = useLetterboxd();
  const isLetterboxd = row.key.startsWith("letterboxd-");
  if (!isLetterboxd) return null;
  const catalogId = row.key.replace("letterboxd-", "");
  return (
    <LetterboxdRowMenu
      canMoveUp={lb.catalogOrder.indexOf(catalogId) > 0}
      canMoveDown={
        lb.catalogOrder.indexOf(catalogId) < lb.catalogOrder.length - 1 &&
        lb.catalogOrder.indexOf(catalogId) !== -1
      }
      hidden={lb.hiddenCatalogs.includes(catalogId)}
      onMoveUp={() => lb.moveCatalog(catalogId, -1)}
      onMoveDown={() => lb.moveCatalog(catalogId, 1)}
      onToggleHidden={() => lb.toggleHidden(catalogId)}
    />
  );
}

export function CustomizableRows({
  rows,
  editMode,
  customization,
  orderKeys,
  onMove,
  onToggleHidden,
  onRename,
  onToggleNumerals,
  onToggleHero,
  onLoadMore,
  onDeleteCustomSource,
  onEditFolderImages,
  hideWatched,
  watchedSet,
  localWatched,
  stremioWatched,
  homeLanguages,
}: {
  rows: HomeRow[];
  editMode: boolean;
  customization: HomeRowCustomization;
  orderKeys: string[];
  onMove: (key: string, delta: -1 | 1) => void;
  onToggleHidden: (key: string) => void;
  onRename: (key: string, label: string) => void;
  onToggleNumerals: (key: string) => void;
  onToggleHero?: (key: string) => void;
  onLoadMore: (key: string) => void;
  onDeleteCustomSource?: (key: string) => void;
  onEditFolderImages?: (sourceId: string, folderId: string, cover: string, gif: string) => void;
  hideWatched?: boolean;
  watchedSet?: Set<string>;
  localWatched?: WatchedSet;
  stremioWatched?: Set<string>;
  homeLanguages?: string[];
}) {
  const { openGrid } = useView();
  const t = useT();
  const posterRow = usePosterRow();
  const { settings } = useSettings();
  const hideUnreleased = settings.hideUnreleased;
  const watchedTitleKeys = useMemo(() => {
    const out = new Set<string>();
    if (!watchedSet) return out;
    for (const k of watchedSet) {
      const parts = k.split(":");
      if (parts.length >= 2) out.add(`${parts[0]}:${parts[1]}`);
    }
    return out;
  }, [watchedSet]);
  const isWatched = (m: { id: string; name?: string }) => {
    if (stremioWatched?.has(m.id)) return true;
    const key = metaTitleKey(m);
    if (key != null && watchedTitleKeys.has(key)) return true;
    if (localWatched) {
      if (localWatched.ids.has(m.id)) return true;
      const tk = watchTitleKey(m.name);
      if (tk && localWatched.titles.has(tk)) return true;
    }
    return false;
  };
  return (
    <>
      {rows.map((row, rowIndex) => {
        const hidden = customization.hidden.includes(row.key);
        if (hidden && !editMode) return null;
        let metas = row.metas.filter((m) => typeof m.id === "string");
        if (homeLanguages && homeLanguages.length > 0) {
          metas = metas.filter(
            (m) => !m.originalLanguage || homeLanguages.includes(m.originalLanguage),
          );
        }
        if (hideWatched) metas = metas.filter((m) => !isWatched(m));
        if (hideUnreleased) metas = metas.filter((m) => !isUnreleased(m));
        if (
          (hideWatched || hideUnreleased || (homeLanguages && homeLanguages.length > 0)) &&
          metas.length === 0 &&
          !row.sourceRow
        )
          return null;
        const idx = orderKeys.indexOf(row.key);
        const title = displayRowTitle(row, row.key in customization.renamed, t);
        const eager = rowIndex < 2;
        const viewAll = row.fetcher
          ? () => openGrid({ title, fetcher: row.fetcher!, initial: row.metas })
          : undefined;
        const ranked = (customization.numerals ?? []).includes(row.key) && metas.length >= 10;
        let rowEl;
        if (row.sourceRow) {
          rowEl = (
            <CustomSourcesRow
              sourceRow={row.sourceRow}
              editMode={editMode}
              onEditFolderImages={onEditFolderImages}
            />
          );
        } else if (ranked) {
          rowEl = (
            <Row
              title={<RowTitle row={row} title={title} />}
              titleExtra={<RowTitleExtra row={row} />}
              min={180}
              shape="rank"
              scrollKey={`home:${row.key}`}
              onViewAll={viewAll}
            >
              {metas.slice(0, 10).map((m, i) => (
                <TopRankCard key={m.id} meta={m} rank={i + 1} />
              ))}
            </Row>
          );
        } else {
          rowEl = (
            <Row
              {...posterRow}
              title={<RowTitle row={row} title={title} />}
              titleExtra={<RowTitleExtra row={row} />}
              scrollKey={`home:${row.key}`}
              onEndReached={row.hasMore ? () => onLoadMore(row.key) : undefined}
              onViewAll={viewAll}
            >
              {metas.map((m, i) => (
                <PickCard key={`${m.id}-${i}`} meta={m} />
              ))}
            </Row>
          );
        }
        return (
          <div key={row.key} data-scroll-anchor={`row:${row.key}`}>
            {editMode && (
              <RowControls
                name={title}
                hidden={hidden}
                canMoveUp={idx > 0}
                canMoveDown={idx >= 0 && idx < orderKeys.length - 1}
                onMoveUp={() => onMove(row.key, -1)}
                onMoveDown={() => onMove(row.key, 1)}
                onToggleHidden={() => onToggleHidden(row.key)}
                onRename={(label) => onRename(row.key, label)}
                onResetName={() => onRename(row.key, "")}
                isRenamed={row.key in customization.renamed}
                numeralsActive={(customization.numerals ?? []).includes(row.key)}
                canNumerals={row.metas.length >= 10}
                onToggleNumerals={() => onToggleNumerals(row.key)}
                heroActive={customization.heroSource === row.key}
                canHero={row.metas.some((m) => m.background || m.poster)}
                onToggleHero={() => onToggleHero?.(row.key)}
                onDelete={row.sourceRow ? () => onDeleteCustomSource?.(row.key) : undefined}
              />
            )}
            {!hidden && (eager ? rowEl : <LazyMount minHeight={340}>{rowEl}</LazyMount>)}
          </div>
        );
      })}
    </>
  );
}
