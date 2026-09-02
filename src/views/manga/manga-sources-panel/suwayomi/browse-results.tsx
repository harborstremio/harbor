import { AlertCircle, ChevronLeft, Loader2, RefreshCw, SearchX } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useMemo, useState } from "react";
import type { ServerConfig, SuwayomiSource } from "@/lib/manga/sources/suwayomi/provider";
import type { MangaSummary } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";
import { CARD, INPUT } from "../shared";
import { MangaGrid, MangaGridSkeleton } from "./manga-grid";
import { useSourceFeed, type FeedMode } from "./use-source-feed";

type BrowseSort = "popular" | "latest" | "alphabetical";

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-lg px-4 text-[13.5px] font-semibold transition-all active:scale-[0.97] motion-reduce:active:scale-100 ${
        active
          ? "bg-accent text-canvas"
          : "bg-raised text-ink-muted ring-1 ring-edge-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function BrowseResults({
  config,
  source,
  onBack,
  onOpen,
}: {
  config: ServerConfig;
  source: SuwayomiSource;
  onBack: () => void;
  onOpen?: (item: MangaSummary) => void;
}) {
  const t = useT();
  const [sort, setSort] = useState<BrowseSort>("popular");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const mode: FeedMode = sort === "latest" ? "latest" : "popular";
  const feed = useSourceFeed(config, source.id, mode, query);
  const items = useMemo(
    () =>
      sort === "alphabetical"
        ? [...feed.items].sort((a, b) => a.title.localeCompare(b.title))
        : feed.items,
    [feed.items, sort],
  );

  const submit = () => setQuery(draft.trim());
  const clear = () => {
    setDraft("");
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-elevated px-3.5 py-2.5 text-[14px] font-medium text-ink ring-1 ring-edge-soft transition-all hover:bg-raised active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <ChevronLeft size={18} strokeWidth={2.4} />
          {t("Sources")}
        </button>
        <span className="truncate text-[17px] font-semibold text-ink">{source.name}</span>
      </div>

      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("Search {name}", { name: source.name })}
          autoCapitalize="off"
          spellCheck={false}
          className={`${INPUT} ps-11 pe-24`}
        />
        <button
          type="button"
          onClick={query ? clear : submit}
          className="absolute end-2 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-raised px-3.5 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95 motion-reduce:active:scale-100"
        >
          {query ? t("Clear") : t("Search")}
        </button>
      </div>

      {!query && (
        <div className="flex gap-2">
          <ModeTab active={sort === "popular"} onClick={() => setSort("popular")}>
            {t("Popular")}
          </ModeTab>
          {source.supportsLatest && (
            <ModeTab active={sort === "latest"} onClick={() => setSort("latest")}>
              {t("Latest")}
            </ModeTab>
          )}
          <ModeTab active={sort === "alphabetical"} onClick={() => setSort("alphabetical")}>
            {t("A-Z")}
          </ModeTab>
        </div>
      )}

      {feed.state === "loading" ? (
        <MangaGridSkeleton />
      ) : feed.state === "error" ? (
        <div
          className={`flex flex-col items-center justify-center gap-3 py-12 text-ink-muted ${CARD}`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-danger" />
            <span className="text-[13.5px]">{t("Could not load results")}</span>
          </div>
          <button
            type="button"
            onClick={feed.retry}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-raised px-5 text-[13.5px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95 motion-reduce:active:scale-100"
          >
            <RefreshCw size={15} strokeWidth={2.2} />
            {t("Retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div
          className={`flex flex-col items-center gap-2 py-12 text-center text-ink-muted ${CARD}`}
        >
          <SearchX size={20} className="text-ink-subtle" />
          <span className="text-[13.5px]">{t("Nothing found here")}</span>
        </div>
      ) : (
        <>
          <MangaGrid items={items} onOpen={onOpen} />
          {feed.loadMoreFailed && (
            <p className="text-center text-[12.5px] font-medium text-danger">
              {t("Could not load results")}
            </p>
          )}
          {feed.hasNext && (
            <button
              type="button"
              onClick={feed.loadMore}
              disabled={feed.loadingMore}
              className="mx-auto inline-flex h-11 items-center gap-2 rounded-xl bg-raised px-6 text-[14px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100"
            >
              {feed.loadingMore && <Loader2 size={16} className="animate-spin" />}
              {feed.loadMoreFailed ? t("Retry") : t("Load more")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
